import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Migrations du contexte projects (table de suivi `projects_migrations`). */
export const projectsMigrations = {
  context: "projects",
  migrations: {
    "0001_create_project": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        CREATE TABLE project (
          id uuid PRIMARY KEY,
          organization_id text NOT NULL,
          name text NOT NULL,
          date date,
          items jsonb NOT NULL DEFAULT '[]',
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `;
      yield* sql`CREATE INDEX project_organization_date_idx ON project (organization_id, date DESC)`;
    }),
  },
};
