import { CurrentActor, SongId } from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Option } from "effect";

import { InvalidLyrics, SongNotFound } from "../domain/errors";
import { parseLyrics } from "../domain/Lyrics";
import { Song, type SongInput, type SongSummary, optionalText } from "../domain/Song";
import { SongRepository } from "./SongRepository";

/** Cas d'usage de la bibliothèque de chants, dans l'organisation de l'acteur courant. */
export class Songs extends Context.Service<
  Songs,
  {
    list(search: string | null): Effect.Effect<ReadonlyArray<SongSummary>, never, CurrentActor>;
    get(id: SongId): Effect.Effect<Song, SongNotFound, CurrentActor>;
    create(input: SongInput): Effect.Effect<Song, InvalidLyrics, CurrentActor>;
    update(
      id: SongId,
      input: SongInput,
    ): Effect.Effect<Song, SongNotFound | InvalidLyrics, CurrentActor>;
    remove(id: SongId): Effect.Effect<void, SongNotFound, CurrentActor>;
  }
>()("@projection/songs/Songs") {
  static readonly layer = Layer.effect(
    Songs,
    Effect.gen(function* () {
      const repository = yield* SongRepository;

      const get = Effect.fn("Songs.get")(function* (id: SongId) {
        const actor = yield* CurrentActor;
        const song = yield* repository.findById(actor.organizationId, id);
        return yield* Option.match(song, {
          onNone: () => Effect.fail(new SongNotFound({ id })),
          onSome: Effect.succeed,
        });
      });

      const create = Effect.fn("Songs.create")(function* (input: SongInput) {
        const actor = yield* CurrentActor;
        const lyrics = yield* parseLyrics(input.lyrics);
        const now = yield* Clock.currentTimeMillis;
        const song = new Song({
          id: SongId.make(crypto.randomUUID()),
          organizationId: actor.organizationId,
          title: input.title,
          authors: optionalText(input.authors),
          copyright: optionalText(input.copyright),
          ccli: optionalText(input.ccli),
          sections: lyrics.sections,
          arrangement: lyrics.arrangement,
          createdAt: now,
          updatedAt: now,
        });
        yield* repository.insert(song);
        return song;
      });

      const update = Effect.fn("Songs.update")(function* (id: SongId, input: SongInput) {
        const existing = yield* get(id);
        const lyrics = yield* parseLyrics(input.lyrics);
        const now = yield* Clock.currentTimeMillis;
        const song = new Song({
          ...existing,
          title: input.title,
          authors: optionalText(input.authors),
          copyright: optionalText(input.copyright),
          ccli: optionalText(input.ccli),
          sections: lyrics.sections,
          arrangement: lyrics.arrangement,
          updatedAt: now,
        });
        yield* repository.update(song);
        return song;
      });

      const remove = Effect.fn("Songs.remove")(function* (id: SongId) {
        const actor = yield* CurrentActor;
        const deleted = yield* repository.delete(actor.organizationId, id);
        if (!deleted) {
          return yield* new SongNotFound({ id });
        }
      });

      const list = Effect.fn("Songs.list")(function* (search: string | null) {
        const actor = yield* CurrentActor;
        return yield* repository.list(actor.organizationId, optionalText(search));
      });

      return Songs.of({ list, get, create, update, remove });
    }),
  );
}
