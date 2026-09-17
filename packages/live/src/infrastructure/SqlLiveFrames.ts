import { PgClient } from "@effect/sql-pg";
import { Frame, type Track, initialFrame } from "@projection/presentation/domain";
import type { OrganizationId, ProjectId } from "@projection/shared-kernel";
import { Clock, Effect, Layer, Option, Schema, Stream, SubscriptionRef } from "effect";
import { SqlSchema } from "effect/unstable/sql";

import { LiveFrames } from "../application/LiveFrames";

/**
 * Canal de réveil des autres instances. La charge utile d'un `NOTIFY` est limitée
 * (8 Ko) et une image peut être plus grosse : on n'envoie que la clé, chaque instance
 * relit l'image en base.
 */
export const FRAMES_CHANNEL = "projection_frames";

const tracks: ReadonlyArray<Track> = ["room", "stream"];

const keyOf = (organizationId: string, projectId: string, track: Track) =>
  `${organizationId}\n${projectId}\n${track}`;

const parseKey = (
  payload: string,
): { organizationId: OrganizationId; projectId: ProjectId; track: Track } | null => {
  const [organizationId, projectId, track] = payload.split("\n");
  if (organizationId === undefined || projectId === undefined) return null;
  if (track !== "room" && track !== "stream") return null;
  return { organizationId: organizationId as OrganizationId, projectId: projectId as ProjectId, track };
};

const Row = Schema.Struct({ frame: Frame });

/**
 * Image courante de chaque piste, partagée entre instances : la base fait autorité et
 * `LISTEN/NOTIFY` réveille les instances, qui tiennent un cache local pour servir leurs
 * écrans sans requête à chaque abonnement.
 */
export const SqlLiveFrames = Layer.effect(
  LiveFrames,
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient;
    const refs = new Map<string, SubscriptionRef.SubscriptionRef<Frame>>();

    const read = SqlSchema.findOneOption({
      Request: Schema.Struct({
        organizationId: Schema.String,
        projectId: Schema.String,
        track: Schema.String,
      }),
      Result: Row,
      execute: ({ organizationId, projectId, track }) => sql`
        SELECT frame FROM live_frame
        WHERE organization_id = ${organizationId}
          AND project_id = ${projectId}::uuid AND track = ${track}
      `,
    });

    const load = (organizationId: OrganizationId, projectId: ProjectId, track: Track) =>
      read({ organizationId, projectId, track }).pipe(
        Effect.map(
          Option.match({
            onNone: () => initialFrame,
            onSome: (row) => row.frame,
          }),
        ),
        Effect.orDie,
      );

    /** Cache local d'une piste, créé à la demande à partir de la base. */
    const refFor = (organizationId: OrganizationId, projectId: ProjectId, track: Track) =>
      Effect.suspend(() => {
        const key = keyOf(organizationId, projectId, track);
        const existing = refs.get(key);
        if (existing !== undefined) return Effect.succeed(existing);
        return load(organizationId, projectId, track).pipe(
          Effect.flatMap(SubscriptionRef.make),
          Effect.map((created) => {
            // Deux créations concurrentes : la première enregistrée gagne.
            if (!refs.has(key)) refs.set(key, created);
            return refs.get(key) ?? created;
          }),
        );
      });

    const write = (
      organizationId: OrganizationId,
      projectId: ProjectId,
      track: Track,
      frame: Frame,
    ) =>
      Effect.gen(function* () {
        yield* sql`
          INSERT INTO live_frame (organization_id, project_id, track, frame, updated_at)
          VALUES (${organizationId}, ${projectId}::uuid, ${track}, ${sql.json({ ...frame })},
                  ${new Date(frame.updatedAt)})
          ON CONFLICT (organization_id, project_id, track) DO UPDATE
            SET frame = EXCLUDED.frame, updated_at = EXCLUDED.updated_at
        `;
        const ref = yield* refFor(organizationId, projectId, track);
        yield* SubscriptionRef.set(ref, frame);
        // Les autres instances relisent l'image et la servent à leurs propres écrans.
        yield* sql.notify(FRAMES_CHANNEL, keyOf(organizationId, projectId, track));
        return frame;
      }).pipe(Effect.orDie);

    const update = (
      organizationId: OrganizationId,
      projectId: ProjectId,
      track: Track,
      transition: (frame: Frame) => Pick<Frame, "cover" | "content" | "stage">,
    ) =>
      Effect.gen(function* () {
        // La base fait autorité : une autre instance a pu publier entre-temps.
        const current = yield* load(organizationId, projectId, track);
        const now = yield* Clock.currentTimeMillis;
        return yield* write(
          organizationId,
          projectId,
          track,
          new Frame({ ...transition(current), version: current.version + 1, updatedAt: now }),
        );
      });

    // Une seule écoute par instance, pour toutes les organisations qu'elle sert.
    const notifications = yield* sql.listen(FRAMES_CHANNEL).pipe(Effect.orDie);
    yield* Stream.fromQueue(notifications).pipe(
      Stream.runForEach((notification) =>
        Effect.gen(function* () {
          const key = parseKey(notification.payload);
          // Piste qu'aucun écran de cette instance ne regarde : rien à rafraîchir.
          if (
            key === null ||
            !refs.has(keyOf(key.organizationId, key.projectId, key.track))
          ) return;
          const frame = yield* load(key.organizationId, key.projectId, key.track);
          const ref = refs.get(keyOf(key.organizationId, key.projectId, key.track));
          if (ref !== undefined) yield* SubscriptionRef.set(ref, frame);
        }),
      ),
      Effect.forkScoped,
    );

    return LiveFrames.of({
      watch: (organizationId, projectId, track) =>
        Stream.unwrap(
          Effect.map(refFor(organizationId, projectId, track), SubscriptionRef.changes),
        ),
      current: (organizationId, projectId, track) => load(organizationId, projectId, track),
      publish: (organizationId, projectId, track, content, cover, stage) =>
        update(organizationId, projectId, track, () => ({ cover, content, stage })).pipe(
          Effect.withSpan("SqlLiveFrames.publish"),
        ),
      show: (organizationId, projectId, content) =>
        Effect.forEach(
          tracks,
          (track) =>
            update(organizationId, projectId, track, (frame) => ({
              cover: frame.cover,
              content,
              stage: frame.stage,
            })),
          { discard: true },
        ).pipe(Effect.withSpan("SqlLiveFrames.show")),
    });
  }),
);
