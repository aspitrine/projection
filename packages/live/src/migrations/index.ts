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
  },
};
