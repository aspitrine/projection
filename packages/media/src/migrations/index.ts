import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Migrations du contexte media (table de suivi `media_migrations`). */
export const mediaMigrations = {
  context: "media",
  migrations: {
    "0001_create_media_asset": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        CREATE TABLE media_asset (
          id uuid PRIMARY KEY,
          organization_id text NOT NULL,
          kind text NOT NULL,
          name text NOT NULL,
          content_type text NOT NULL,
          size_bytes bigint NOT NULL,
          storage_key text NOT NULL,
          ready boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL
        )
      `;
      yield* sql`CREATE INDEX media_asset_organization_idx ON media_asset (organization_id, created_at DESC)`;
    }),
  },
};
