import { Cover, VideoPlayback } from "@projection/presentation/domain";
import { OrganizationId, ProjectId, ProjectItemId } from "@projection/shared-kernel";
import { PgClient } from "@effect/sql-pg";
import { Effect, Layer, Option, Schema, Stream } from "effect";
import { SqlSchema } from "effect/unstable/sql";

import { LiveSessionRepository } from "../application/ports";
import { LiveCursor, LiveSession, StreamCursor, StreamOverride } from "../domain/LiveSession";

const Row = Schema.Struct({
  organizationId: OrganizationId,
  projectId: Schema.NullOr(ProjectId),
  itemId: Schema.NullOr(ProjectItemId),
  slideIndex: Schema.Int,
  roomCover: Cover,
  streamCover: Cover,
  streamLinked: Schema.Boolean,
  streamItemId: Schema.NullOr(ProjectItemId),
  streamSlideIndex: Schema.Int,
  streamPart: Schema.Int,
  streamOverride: Schema.NullOr(StreamOverride),
  video: VideoPlayback,
  version: Schema.Int,
  updatedAt: Schema.Number,
});

/** Canal de réveil des régies branchées sur les autres instances. */
export const SESSION_CHANNEL = "projection_live_session";

export const SqlLiveSessionRepository = Layer.effect(
  LiveSessionRepository,
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient;

    // Postgres ne renvoie pas à l'émetteur ses propres notifications sur une autre
    // connexion : chaque instance ne reçoit donc que les changements des autres.
    const notifications = yield* sql.listen(SESSION_CHANNEL).pipe(Effect.orDie);

    const load = SqlSchema.findOneOption({
      Request: OrganizationId,
      Result: Row,
      execute: (organizationId) => sql`
        SELECT organization_id AS "organizationId", project_id::text AS "projectId",
          item_id::text AS "itemId", slide_index AS "slideIndex",
          room_cover AS "roomCover", stream_cover AS "streamCover",
          stream_linked AS "streamLinked", stream_item_id::text AS "streamItemId",
          stream_slide_index AS "streamSlideIndex", stream_part AS "streamPart",
          stream_override AS "streamOverride", video, version,
          (extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt"
        FROM live_session WHERE organization_id = ${organizationId}
      `,
    });

    return LiveSessionRepository.of({
      announce: (organizationId) =>
        sql
          .notify(SESSION_CHANNEL, organizationId)
          .pipe(Effect.orDie, Effect.withSpan("SqlLiveSessionRepository.announce")),

      changed: Stream.fromQueue(notifications).pipe(
        Stream.map((notification) => OrganizationId.make(notification.payload)),
      ),

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
                  roomCover: row.roomCover,
                  streamCover: row.streamCover,
                  streamLinked: row.streamLinked,
                  streamCursor:
                    row.streamItemId === null
                      ? null
                      : new StreamCursor({
                          itemId: row.streamItemId,
                          slideIndex: row.streamSlideIndex,
                          part: row.streamPart,
                        }),
                  streamOverride: row.streamOverride,
                  video: row.video,
                  version: row.version,
                  updatedAt: row.updatedAt,
                }),
            ),
          ),
          Effect.orDie,
          Effect.withSpan("SqlLiveSessionRepository.load"),
        ),

      save: (session) => {
        const override =
          session.streamOverride === null ? null : JSON.stringify(session.streamOverride);
        return sql`
          INSERT INTO live_session (organization_id, project_id, item_id, slide_index,
            room_cover, stream_cover, stream_linked, stream_item_id, stream_slide_index,
            stream_part, stream_override, video, version, updated_at)
          VALUES (${session.organizationId}, ${session.projectId}::uuid, ${session.cursor?.itemId ?? null}::uuid,
                  ${session.cursor?.slideIndex ?? 0}, ${session.roomCover}, ${session.streamCover},
                  ${session.streamLinked}, ${session.streamCursor?.itemId ?? null}::uuid,
                  ${session.streamCursor?.slideIndex ?? 0}, ${session.streamCursor?.part ?? 0},
                  ${override}::jsonb,
                  ${JSON.stringify(session.video)}::jsonb,
                  ${session.version}, ${new Date(session.updatedAt)})
          ON CONFLICT (organization_id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            item_id = EXCLUDED.item_id,
            slide_index = EXCLUDED.slide_index,
            room_cover = EXCLUDED.room_cover,
            stream_cover = EXCLUDED.stream_cover,
            stream_linked = EXCLUDED.stream_linked,
            stream_item_id = EXCLUDED.stream_item_id,
            stream_slide_index = EXCLUDED.stream_slide_index,
            stream_part = EXCLUDED.stream_part,
            stream_override = EXCLUDED.stream_override,
            video = EXCLUDED.video,
            version = EXCLUDED.version,
            updated_at = EXCLUDED.updated_at
        `.pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("SqlLiveSessionRepository.save"));
      },
    });
  }),
);
