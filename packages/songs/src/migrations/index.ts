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
  },
};
