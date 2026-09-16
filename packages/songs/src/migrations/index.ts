import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Migrations du contexte songs (table de suivi `songs_migrations`). */
export const songsMigrations = {
  context: "songs",
  migrations: {
    "0001_create_song": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        CREATE TABLE song (
          id uuid PRIMARY KEY,
          organization_id text NOT NULL,
          title text NOT NULL,
          authors text,
          copyright text,
          ccli text,
          sections jsonb NOT NULL,
          arrangement jsonb NOT NULL,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `;
      yield* sql`CREATE INDEX song_organization_title_idx ON song (organization_id, lower(title))`;
    }),
    "0002_add_song_external_id": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`ALTER TABLE song ADD COLUMN external_id text`;
      yield* sql`
        CREATE UNIQUE INDEX song_external_id_idx
        ON song (organization_id, external_id)
        WHERE external_id IS NOT NULL
      `;
    }),
    "0003_song_search": Effect.gen(function* () {
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
      // Texte de recherche tenu à jour par le dépôt : titre, auteurs et paroles à plat.
      yield* sql`ALTER TABLE song ADD COLUMN search_source text NOT NULL DEFAULT ''`;
      yield* sql`
        UPDATE song SET search_source = concat_ws(' ', title, authors, (
          SELECT string_agg(line, ' ')
          FROM jsonb_array_elements(sections) AS section,
               jsonb_array_elements_text(section -> 'lines') AS line
        ))
      `;
      yield* sql`
        ALTER TABLE song ADD COLUMN search tsvector
        GENERATED ALWAYS AS (to_tsvector('french', projection_unaccent(search_source))) STORED
      `;
      yield* sql`CREATE INDEX song_search_idx ON song USING gin (search)`;
    }),
  },
};
