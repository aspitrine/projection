import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Migrations du contexte outputs (table de suivi `outputs_migrations`). */
export const outputsMigrations = {
  context: "outputs",
  migrations: {
    "0001_create_output": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        CREATE TABLE output (
          id uuid PRIMARY KEY,
          organization_id text NOT NULL,
          name text NOT NULL,
          type text NOT NULL,
          token text NOT NULL UNIQUE,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `;
      yield* sql`CREATE INDEX output_organization_idx ON output (organization_id)`;
    }),
  },
};
