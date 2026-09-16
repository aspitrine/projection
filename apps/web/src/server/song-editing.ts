import { LiveEditFailed } from "@projection/live/domain";
import { SongEditing } from "@projection/live/server";
import { SongId } from "@projection/shared-kernel";
import { SongInput, SongSection, formatLyrics, formatTag } from "@projection/songs/domain";
import { Songs } from "@projection/songs/server";
import { Effect, Layer, Option, Schema } from "effect";

const decodeSongId = Schema.decodeUnknownOption(SongId);

/**
 * Édition d'une section depuis la régie : la bibliothèque est la source de vérité,
 * dernière écriture gagnante (le chant entier est réécrit à partir de ses sections).
 */
export const SongEditingLive = Layer.effect(
  SongEditing,
  Effect.gen(function* () {
    const songs = yield* Songs;

    return SongEditing.of({
      updateSection: Effect.fn("SongEditing.updateSection")(function* (
        songId: string,
        sectionId: string,
        lines: ReadonlyArray<string>,
      ) {
        const id = decodeSongId(songId);
        if (Option.isNone(id)) return yield* new LiveEditFailed({ reason: "NotFound" });

        const song = yield* songs
          .get(id.value)
          .pipe(
            Effect.catchTag("SongNotFound", () =>
              Effect.fail(new LiveEditFailed({ reason: "NotFound" })),
            ),
          );
        const section = song.sections.find((candidate) => candidate.id === sectionId);
        if (section === undefined) return yield* new LiveEditFailed({ reason: "NotFound" });

        const cleaned = lines.map((line) => line.trim()).filter((line) => line !== "");
        if (cleaned.length === 0) return yield* new LiveEditFailed({ reason: "InvalidLyrics" });

        const sections = song.sections.map((candidate) =>
          candidate.id === sectionId
            ? new SongSection({ ...candidate, lines: cleaned })
            : candidate,
        );
        yield* songs
          .update(
            song.id,
            new SongInput({
              title: song.title,
              authors: song.authors,
              copyright: song.copyright,
              ccli: song.ccli,
              lyrics: formatLyrics({ sections, arrangement: song.arrangement }),
            }),
          )
          .pipe(Effect.catch(() => Effect.fail(new LiveEditFailed({ reason: "InvalidLyrics" }))));

        return { title: song.title, section: formatTag(section) };
      }),
    });
  }),
);
