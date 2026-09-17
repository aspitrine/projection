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
    "0003_add_output_theme": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`ALTER TABLE output ADD COLUMN theme jsonb`;
    }),
    "0004_add_theme_background": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // Les thèmes déjà enregistrés reçoivent les nouvelles clés : le décodage reste strict.
      yield* sql`
        UPDATE output
        SET theme = theme || '{"backgroundMediaId": null, "backgroundDim": 0}'::jsonb
        WHERE theme IS NOT NULL
      `;
    }),
    "0005_scope_outputs_to_project": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`ALTER TABLE output ADD COLUMN project_id uuid`;
      // Une sortie globale ne peut pas être attribuée sans ambiguïté à un projet.
      // Les sorties par projet seront recréées à la première ouverture de leur panneau.
      yield* sql`DELETE FROM output`;
      yield* sql`ALTER TABLE output ALTER COLUMN project_id SET NOT NULL`;
      yield* sql`DROP INDEX output_organization_idx`;
      yield* sql`CREATE INDEX output_project_idx ON output (organization_id, project_id)`;
    }),
    "0002_create_output_splitting": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        CREATE TABLE output_splitting (
          organization_id text PRIMARY KEY,
          room jsonb NOT NULL,
          stream jsonb NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `;
    }),
  },
};
