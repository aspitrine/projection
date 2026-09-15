import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Migrations du contexte bible (table de suivi `bible_migrations`). */
export const bibleMigrations = {
  context: "bible",
  migrations: {
    "0001_create_bible": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        CREATE TABLE bible_translation (
          id text PRIMARY KEY,
          code text NOT NULL,
          name text NOT NULL,
          language text NOT NULL,
          license text NOT NULL
        )
      `;
      yield* sql`
        CREATE TABLE bible_verse (
          translation_id text NOT NULL REFERENCES bible_translation (id) ON DELETE CASCADE,
          book text NOT NULL,
          book_order smallint NOT NULL,
          chapter smallint NOT NULL,
          verse smallint NOT NULL,
          text text NOT NULL,
          PRIMARY KEY (translation_id, book, chapter, verse)
        )
      `;
    }),
  },
};
