import { OrganizationId, ProjectId, ProjectItemId } from "@projection/shared-kernel";
import { Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

import { LiveSessionRepository } from "../application/ports";
import { LiveCursor, LiveSession } from "../domain/LiveSession";

const Row = Schema.Struct({
  organizationId: OrganizationId,
  projectId: Schema.NullOr(ProjectId),
  itemId: Schema.NullOr(ProjectItemId),
  slideIndex: Schema.Int,
  blackout: Schema.Boolean,
  version: Schema.Int,
  updatedAt: Schema.Number,
});

export const SqlLiveSessionRepository = Layer.effect(
  LiveSessionRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const load = SqlSchema.findOneOption({
      Request: OrganizationId,
      Result: Row,
      execute: (organizationId) => sql`
        SELECT organization_id AS "organizationId", project_id::text AS "projectId",
          item_id::text AS "itemId", slide_index AS "slideIndex", blackout, version,
          (extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt"
        FROM live_session WHERE organization_id = ${organizationId}
      `,
    });

    return LiveSessionRepository.of({
      load: (organizationId) =>
        load(organizationId).pipe(
          Effect.map(
            Option.map(
              (row) =>
                new LiveSession({
                  organizationId: row.organizationId,
                  projectId: row.projectId,
                  cursor:
                    row.itemId === null
                      ? null
                      : new LiveCursor({ itemId: row.itemId, slideIndex: row.slideIndex }),
                  blackout: row.blackout,
                  version: row.version,
                  updatedAt: row.updatedAt,
                }),
            ),
          ),
          Effect.orDie,
          Effect.withSpan("SqlLiveSessionRepository.load"),
        ),

      save: (session) =>
        sql`
          INSERT INTO live_session (organization_id, project_id, item_id, slide_index, blackout, version, updated_at)
          VALUES (${session.organizationId}, ${session.projectId}::uuid, ${session.cursor?.itemId ?? null}::uuid,
                  ${session.cursor?.slideIndex ?? 0}, ${session.blackout}, ${session.version},
                  ${new Date(session.updatedAt)})
          ON CONFLICT (organization_id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            item_id = EXCLUDED.item_id,
            slide_index = EXCLUDED.slide_index,
            blackout = EXCLUDED.blackout,
            version = EXCLUDED.version,
            updated_at = EXCLUDED.updated_at
        `.pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("SqlLiveSessionRepository.save")),
    });
  }),
);
