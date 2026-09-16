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
    "0002_verse_search": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // `unaccent` est une extension « de confiance » : le propriétaire de la base peut
      // l'installer. Elle est STABLE, donc on l'enveloppe pour pouvoir indexer.
      // Le verrou sérialise deux contextes qui migrent en même temps sur une base neuve.
      yield* sql`SELECT pg_advisory_xact_lock(hashtext('projection:search-setup'))`;
      yield* sql`CREATE EXTENSION IF NOT EXISTS unaccent`;
      yield* sql`
        CREATE OR REPLACE FUNCTION projection_unaccent(text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $$ SELECT public.unaccent('public.unaccent', $1) $$
      `;
      yield* sql`
        ALTER TABLE bible_verse ADD COLUMN search tsvector
        GENERATED ALWAYS AS (to_tsvector('french', projection_unaccent(text))) STORED
      `;
      yield* sql`CREATE INDEX bible_verse_search_idx ON bible_verse USING gin (search)`;
    }),
    "0003_translation_owner": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // `NULL` : traduction livrée avec l'application (domaine public), visible par tous.
      yield* sql`ALTER TABLE bible_translation ADD COLUMN organization_id text`;
      yield* sql`
        CREATE TABLE bible_preference (
          organization_id text PRIMARY KEY,
          default_translation_id text REFERENCES bible_translation (id) ON DELETE SET NULL
        )
      `;
    }),
  },
};
