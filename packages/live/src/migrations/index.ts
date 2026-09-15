import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Migrations du contexte live (table de suivi `live_migrations`). */
export const liveMigrations = {
  context: "live",
  migrations: {
    "0001_create_live_session": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        CREATE TABLE live_session (
          organization_id text PRIMARY KEY,
          project_id uuid,
          item_id uuid,
          slide_index integer NOT NULL DEFAULT 0,
          blackout boolean NOT NULL DEFAULT false,
          version integer NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `;
    }),
    "0002_add_stream_track": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        ALTER TABLE live_session
          ADD COLUMN stream_linked boolean NOT NULL DEFAULT true,
          ADD COLUMN stream_item_id uuid,
          ADD COLUMN stream_slide_index integer NOT NULL DEFAULT 0,
          ADD COLUMN stream_part integer NOT NULL DEFAULT 0
      `;
    }),
    "0003_add_stream_override": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`ALTER TABLE live_session ADD COLUMN stream_override jsonb`;
    }),
  },
};
