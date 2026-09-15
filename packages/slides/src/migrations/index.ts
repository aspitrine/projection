import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Migrations du contexte slides (table de suivi `slides_migrations`). */
export const slidesMigrations = {
  context: "slides",
  migrations: {
    "0001_create_text_slide": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        CREATE TABLE text_slide (
          id uuid PRIMARY KEY,
          organization_id text NOT NULL,
          title text NOT NULL,
          source text NOT NULL,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `;
      yield* sql`CREATE INDEX text_slide_organization_title_idx ON text_slide (organization_id, lower(title))`;
    }),
  },
};
