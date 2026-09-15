import { Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

import { ScriptureRepository } from "../application/ScriptureRepository";
import { BookCode } from "../domain/Books";
import { Translation, Verse } from "../domain/Scripture";

export const SqlScriptureRepository = Layer.effect(
  ScriptureRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const translations = SqlSchema.findAll({
      Request: Schema.Void,
      Result: Translation,
      execute: () =>
        sql`SELECT id, code, name, language, license FROM bible_translation ORDER BY name`,
    });

    const verses = SqlSchema.findAll({
      Request: Schema.Struct({
        translationId: Schema.String,
        book: BookCode,
        startChapter: Schema.Int,
        startVerse: Schema.Int,
        endChapter: Schema.Int,
        endVerse: Schema.Int,
      }),
      Result: Verse,
      execute: (request) => sql`
        SELECT book, chapter, verse, text
        FROM bible_verse
        WHERE translation_id = ${request.translationId}
          AND book = ${request.book}
          AND (chapter, verse) >= (${request.startChapter}, ${request.startVerse})
          AND (chapter, verse) <= (${request.endChapter}, ${request.endVerse})
        ORDER BY chapter, verse
      `,
    });

    return ScriptureRepository.of({
      translations: translations().pipe(
        Effect.orDie,
        Effect.withSpan("SqlScriptureRepository.translations"),
      ),
      verses: (translationId, { book, start, end }) =>
        verses({
          translationId,
          book,
          startChapter: start.chapter,
          startVerse: start.verse ?? 0,
          endChapter: end.chapter,
          endVerse: end.verse ?? 32767,
        }).pipe(Effect.orDie, Effect.withSpan("SqlScriptureRepository.verses")),
    });
  }),
);
