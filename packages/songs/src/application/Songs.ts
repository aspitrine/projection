import { CurrentActor, SongId } from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Option } from "effect";

import { type ImportedSong, InvalidSongFile, parseChordPro } from "../domain/ChordPro";

import { InvalidLyrics, SongNotFound } from "../domain/errors";
import { type ImportFile, type ImportFormat, ImportReport } from "../domain/Import";
import { parseLyrics } from "../domain/Lyrics";
import { parseOpenLyrics } from "../domain/OpenLyrics";
import { Song, SongInput, type SongSummary, optionalText } from "../domain/Song";
import { SongRepository } from "./SongRepository";

/** Titre comparé sans casse, accents ni espaces multiples (détection des doublons à l'import). */
const normalizeTitle = (title: string) =>
  title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Chaque format a son parser ; l'échec est le même pour tous : aucune parole trouvée. */
const parseSongFile = (
  format: ImportFormat,
  content: string,
  fallbackTitle: string,
): Effect.Effect<ImportedSong, InvalidSongFile> => {
  if (format === "chordpro") return parseChordPro(content, fallbackTitle);
  return Effect.suspend(() => {
    const song = parseOpenLyrics(content, fallbackTitle);
    return song === null
      ? Effect.fail(new InvalidSongFile({ reason: "NoLyrics" }))
      : Effect.succeed(song);
  });
};

type ImportOutcome =
  | { readonly _tag: "Imported"; readonly song: Song }
  | { readonly _tag: "Duplicate"; readonly title: string }
  | { readonly _tag: "Failed"; readonly reason: ImportReport["errors"][number]["reason"] };

/** Cas d'usage de la bibliothèque de chants, dans l'organisation de l'acteur courant. */
export class Songs extends Context.Service<
  Songs,
  {
    list(search: string | null): Effect.Effect<ReadonlyArray<SongSummary>, never, CurrentActor>;
    get(id: SongId): Effect.Effect<Song, SongNotFound, CurrentActor>;
    create(input: SongInput, externalId?: string): Effect.Effect<Song, InvalidLyrics, CurrentActor>;
    /** Chant déjà importé depuis la même source, s'il existe. */
    findByExternalId(externalId: string): Effect.Effect<Option.Option<Song>, never, CurrentActor>;
    update(
      id: SongId,
      input: SongInput,
    ): Effect.Effect<Song, SongNotFound | InvalidLyrics, CurrentActor>;
    remove(id: SongId): Effect.Effect<void, SongNotFound, CurrentActor>;
    /** Import de fichiers : un chant par fichier, doublons (même titre) ignorés. */
    importFiles(
      format: ImportFormat,
      files: ReadonlyArray<ImportFile>,
    ): Effect.Effect<ImportReport, never, CurrentActor>;
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

      const create = Effect.fn("Songs.create")(function* (input: SongInput, externalId?: string) {
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
          externalId: externalId ?? null,
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

      const importFiles = Effect.fn("Songs.importFiles")(function* (
        format: ImportFormat,
        files: ReadonlyArray<ImportFile>,
      ) {
        const actor = yield* CurrentActor;
        const existing = yield* repository.list(actor.organizationId, null);
        const titles = new Set(existing.map((song) => normalizeTitle(song.title)));
        const report = {
          imported: [] as Array<ImportReport["imported"][number]>,
          duplicates: [] as Array<ImportReport["duplicates"][number]>,
          errors: [] as Array<ImportReport["errors"][number]>,
        };

        for (const { fileName, content } of files) {
          const fallbackTitle = fileName.replace(/\.[^.]+$/, "").trim() || "Sans titre";
          const outcome = yield* parseSongFile(format, content, fallbackTitle).pipe(
            Effect.flatMap(
              (imported): Effect.Effect<ImportOutcome, InvalidLyrics, CurrentActor> => {
                const title = imported.title.trim() || fallbackTitle;
                if (titles.has(normalizeTitle(title))) {
                  return Effect.succeed({ _tag: "Duplicate", title });
                }
                return create(new SongInput({ ...imported, title })).pipe(
                  Effect.map((song): ImportOutcome => ({ _tag: "Imported", song })),
                );
              },
            ),
            Effect.catch((error) =>
              Effect.succeed<ImportOutcome>({ _tag: "Failed", reason: error.reason }),
            ),
          );

          switch (outcome._tag) {
            case "Imported":
              titles.add(normalizeTitle(outcome.song.title));
              report.imported.push({ fileName, id: outcome.song.id, title: outcome.song.title });
              break;
            case "Duplicate":
              report.duplicates.push({ fileName, title: outcome.title });
              break;
            case "Failed":
              report.errors.push({ fileName, reason: outcome.reason });
              break;
          }
        }
        return new ImportReport(report);
      });

      const findByExternalId = Effect.fn("Songs.findByExternalId")(function* (externalId: string) {
        const actor = yield* CurrentActor;
        return yield* repository.findByExternalId(actor.organizationId, externalId);
      });

      return Songs.of({ list, get, create, update, remove, importFiles, findByExternalId });
    }),
  );
}
