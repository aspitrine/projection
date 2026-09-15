import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { bookCodes } from "../domain/Books";
import type { Translation } from "../domain/Scripture";
import { parseUsfm } from "../domain/Usfm";

const knownBooks = new Map<string, number>(bookCodes.map((code, index) => [code, index + 1]));

/**
 * Importe une traduction depuis des fichiers USFM, de façon idempotente :
 * la traduction est créée ou mise à jour et ses versets remplacés, en transaction.
 * Les livres hors canon protestant (deutérocanoniques…) sont ignorés.
 */
export const importTranslation = Effect.fn("importTranslation")(function* (
  translation: Translation,
  usfmFiles: ReadonlyArray<string>,
) {
  const sql = yield* SqlClient.SqlClient;

  const rows = usfmFiles.flatMap((content) => {
    const book = parseUsfm(content);
    const order = knownBooks.get(book.code);
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
      INSERT INTO bible_translation (id, code, name, language, license)
      VALUES (${translation.id}, ${translation.code}, ${translation.name}, ${translation.language}, ${translation.license})
      ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name,
        language = EXCLUDED.language, license = EXCLUDED.license
    `;
    yield* sql`DELETE FROM bible_verse WHERE translation_id = ${translation.id}`;
    for (let offset = 0; offset < rows.length; offset += 1000) {
      yield* sql`INSERT INTO bible_verse ${sql.insert(rows.slice(offset, offset + 1000))}`;
    }
  }).pipe(sql.withTransaction);

  return {
    books: new Set(rows.map((row) => row.book)).size,
    verses: rows.length,
  };
});
