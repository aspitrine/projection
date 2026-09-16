import { excerptAround } from "@projection/shared-kernel";
import { Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

import { ScriptureRepository } from "../application/ScriptureRepository";
import { BookCode } from "../domain/Books";
import { bookCodes } from "../domain/Books";
import type { ParsedBook } from "../domain/Osis";
import { ScriptureMatch, Translation, Verse, verseLabel } from "../domain/Scripture";

/** Ordre canonique, pour trier les versets d'un bout à l'autre de la Bible. */
const bookOrder = new Map(bookCodes.map((code, index) => [code, index + 1]));

export const SqlScriptureRepository = Layer.effect(
  ScriptureRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const translations = SqlSchema.findAll({
      Request: Schema.String,
      Result: Translation,
      // Traductions livrées avec l'application (sans propriétaire) plus celles de l'organisation.
      execute: (organizationId) => sql`
        SELECT id, code, name, language, license, organization_id AS "organizationId"
        FROM bible_translation
        WHERE organization_id IS NULL OR organization_id = ${organizationId}
        ORDER BY name
      `,
    });

    const preference = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: Schema.Struct({ defaultTranslationId: Schema.NullOr(Schema.String) }),
      execute: (organizationId) => sql`
        SELECT default_translation_id AS "defaultTranslationId"
        FROM bible_preference WHERE organization_id = ${organizationId}
      `,
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

    const importBooks = Effect.fn("SqlScriptureRepository.write")(function* (
      translation: Translation,
      books: ReadonlyArray<ParsedBook>,
    ) {
      const rows = books.flatMap((book) => {
        const order = bookOrder.get(book.code);
        return order === undefined
          ? []
          : book.verses.map((verse) => ({
              translation_id: translation.id,
              book: book.code,
              book_order: order,
              chapter: verse.chapter,
              verse: verse.verse,
              text: verse.text,
            }));
      });

      yield* Effect.gen(function* () {
        yield* sql`
          INSERT INTO bible_translation (id, code, name, language, license, organization_id)
          VALUES (${translation.id}, ${translation.code}, ${translation.name},
                  ${translation.language}, ${translation.license}, ${translation.organizationId})
          ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name,
            language = EXCLUDED.language, license = EXCLUDED.license,
            organization_id = EXCLUDED.organization_id
        `;
        yield* sql`DELETE FROM bible_verse WHERE translation_id = ${translation.id}`;
        for (let offset = 0; offset < rows.length; offset += 1000) {
          yield* sql`INSERT INTO bible_verse ${sql.insert(rows.slice(offset, offset + 1000))}`;
        }
      }).pipe(sql.withTransaction);

      return { books: new Set(rows.map((row) => row.book)).size, verses: rows.length };
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

      translations: (organizationId) =>
        translations(organizationId).pipe(
          Effect.orDie,
          Effect.withSpan("SqlScriptureRepository.translations"),
        ),

      importBooks: (translation, books) =>
        importBooks(translation, books).pipe(
          Effect.orDie,
          Effect.withSpan("SqlScriptureRepository.importBooks"),
        ),

      defaultTranslationId: (organizationId) =>
        preference(organizationId).pipe(
          Effect.map((row) =>
            row._tag === "Some" ? (row.value.defaultTranslationId ?? null) : null,
          ),
          Effect.orDie,
          Effect.withSpan("SqlScriptureRepository.defaultTranslationId"),
        ),

      setDefaultTranslation: (organizationId, translationId) =>
        sql`
          INSERT INTO bible_preference (organization_id, default_translation_id)
          VALUES (${organizationId}, ${translationId})
          ON CONFLICT (organization_id)
          DO UPDATE SET default_translation_id = EXCLUDED.default_translation_id
        `.pipe(
          Effect.asVoid,
          Effect.orDie,
          Effect.withSpan("SqlScriptureRepository.setDefaultTranslation"),
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
