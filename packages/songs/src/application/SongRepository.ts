import type { OrganizationId, SongId } from "@projection/shared-kernel";
import { Context, Effect, Layer, Option, Ref } from "effect";

import { Song, SongSummary } from "../domain/Song";

/** Port de persistance. Toutes les opérations sont limitées à une organisation. */
export class SongRepository extends Context.Service<
  SongRepository,
  {
    list(
      organizationId: OrganizationId,
      search: string | null,
    ): Effect.Effect<ReadonlyArray<SongSummary>>;
    findById(organizationId: OrganizationId, id: SongId): Effect.Effect<Option.Option<Song>>;
    findByExternalId(
      organizationId: OrganizationId,
      externalId: string,
    ): Effect.Effect<Option.Option<Song>>;
    insert(song: Song): Effect.Effect<void>;
    update(song: Song): Effect.Effect<void>;
    delete(organizationId: OrganizationId, id: SongId): Effect.Effect<boolean>;
  }
>()("@projection/songs/SongRepository") {
  /** Implémentation en mémoire pour les tests d'application. */
  static readonly layerMemory = Layer.effect(
    SongRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<SongId, Song>());

      const normalize = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase();

      return SongRepository.of({
        list: (organizationId, search) =>
          Ref.get(store).pipe(
            Effect.map((songs) =>
              [...songs.values()]
                .filter((song) => song.organizationId === organizationId)
                .filter(
                  (song) => search === null || normalize(song.title).includes(normalize(search)),
                )
                .sort((a, b) => a.title.localeCompare(b.title))
                .map(
                  (song) =>
                    new SongSummary({
                      id: song.id,
                      title: song.title,
                      authors: song.authors,
                      updatedAt: song.updatedAt,
                    }),
                ),
            ),
          ),
        findByExternalId: (organizationId, externalId) =>
          Ref.get(store).pipe(
            Effect.map((songs) =>
              Option.fromNullishOr(
                [...songs.values()].find(
                  (song) =>
                    song.organizationId === organizationId && song.externalId === externalId,
                ),
              ),
            ),
          ),
        findById: (organizationId, id) =>
          Ref.get(store).pipe(
            Effect.map((songs) =>
              Option.fromNullishOr(songs.get(id)).pipe(
                Option.filter((song) => song.organizationId === organizationId),
              ),
            ),
          ),
        insert: (song) => Ref.update(store, (songs) => new Map(songs).set(song.id, song)),
        update: (song) => Ref.update(store, (songs) => new Map(songs).set(song.id, song)),
        delete: (organizationId, id) =>
          Ref.modify(store, (songs) => {
            const song = songs.get(id);
            if (song === undefined || song.organizationId !== organizationId) {
              return [false, songs] as const;
            }
            const next = new Map(songs);
            next.delete(id);
            return [true, next] as const;
          }),
      });
    }),
  );
}
