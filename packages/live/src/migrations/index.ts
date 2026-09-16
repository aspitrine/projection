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
    "0004_track_covers": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        ALTER TABLE live_session
          ADD COLUMN room_cover text NOT NULL DEFAULT 'none',
          ADD COLUMN stream_cover text NOT NULL DEFAULT 'none'
      `;
      yield* sql`UPDATE live_session SET room_cover = 'black', stream_cover = 'black' WHERE blackout`;
      yield* sql`ALTER TABLE live_session DROP COLUMN blackout`;
    }),
    "0005_add_stage_timer": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        ALTER TABLE live_session
          ADD COLUMN stage_timer jsonb NOT NULL
          DEFAULT '{"durationMs":0,"elapsedMs":0,"runningSince":null}'
      `;
    }),

    "0006_create_live_frame": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // Image courante de chaque piste : partagée par toutes les instances, donc en base.
      yield* sql`
        CREATE TABLE live_frame (
          organization_id text NOT NULL,
          track text NOT NULL,
          frame jsonb NOT NULL,
          updated_at timestamptz NOT NULL,
          PRIMARY KEY (organization_id, track)
        )
      `;
    }),

    "0007_add_session_video": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // La lecture vidéo devient partagée : une régie d'une autre instance la reprend.
      yield* sql`
        ALTER TABLE live_session ADD COLUMN video jsonb NOT NULL
          DEFAULT '{"playing": false, "positionMs": 0, "since": null, "durationMs": 0}'::jsonb
      `;
    }),
  },
};
