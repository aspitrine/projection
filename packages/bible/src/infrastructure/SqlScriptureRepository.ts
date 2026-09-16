import { excerptAround } from "@projection/shared-kernel";
import { Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

import { ScriptureRepository } from "../application/ScriptureRepository";
import { BookCode } from "../domain/Books";
import { ScriptureMatch, Translation, Verse, verseLabel } from "../domain/Scripture";

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

    const search = SqlSchema.findAll({
      Request: Schema.Struct({
        translationId: Schema.String,
        query: Schema.String,
        limit: Schema.Int,
      }),
      Result: ScriptureMatch,
      // Recherche plein texte française, sans accents ; l'extrait encadre les mots trouvés
      // et les résultats restent dans l'ordre canonique du texte.
      execute: (request) => sql`
        SELECT
          ${request.translationId} AS "translationId",
          '' AS "label",
          jsonb_build_object('book', book, 'chapter', chapter, 'verse', verse, 'text', text) AS "verse",
          text AS "excerpt"
        FROM bible_verse
        WHERE translation_id = ${request.translationId}
          AND search @@ websearch_to_tsquery('french', projection_unaccent(${request.query}))
        ORDER BY book_order, chapter, verse
        LIMIT ${request.limit}
      `,
    });

    return ScriptureRepository.of({
      search: (translationId, query, limit) =>
        search({ translationId, query, limit }).pipe(
          // Le libellé (« Jean 3.16 ») vient du domaine, qui connaît les noms français.
          Effect.map((matches) =>
            matches.map(
              (match) =>
                new ScriptureMatch({
                  ...match,
                  label: verseLabel(match.verse),
                  // Mots trouvés encadrés dans le texte d'origine, accents compris.
                  excerpt: excerptAround(match.verse.text, query, 200) ?? match.verse.text,
                }),
            ),
          ),
          Effect.orDie,
          Effect.withSpan("SqlScriptureRepository.search"),
        ),

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
