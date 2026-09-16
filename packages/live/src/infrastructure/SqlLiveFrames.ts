import { PgClient } from "@effect/sql-pg";
import { Frame, type Track, initialFrame } from "@projection/presentation/domain";
import type { OrganizationId } from "@projection/shared-kernel";
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

const keyOf = (organizationId: string, track: Track) => `${organizationId}:${track}`;

const parseKey = (payload: string): { organizationId: OrganizationId; track: Track } | null => {
  const separator = payload.lastIndexOf(":");
  if (separator <= 0) return null;
  const track = payload.slice(separator + 1);
  if (track !== "room" && track !== "stream") return null;
  return { organizationId: payload.slice(0, separator) as OrganizationId, track };
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
      Request: Schema.Struct({ organizationId: Schema.String, track: Schema.String }),
      Result: Row,
      execute: ({ organizationId, track }) => sql`
        SELECT frame FROM live_frame
        WHERE organization_id = ${organizationId} AND track = ${track}
      `,
    });

    const load = (organizationId: OrganizationId, track: Track) =>
      read({ organizationId, track }).pipe(
        Effect.map(
          Option.match({
            onNone: () => initialFrame,
            onSome: (row) => row.frame,
          }),
        ),
        Effect.orDie,
      );

    /** Cache local d'une piste, créé à la demande à partir de la base. */
    const refFor = (organizationId: OrganizationId, track: Track) =>
      Effect.suspend(() => {
        const key = keyOf(organizationId, track);
        const existing = refs.get(key);
        if (existing !== undefined) return Effect.succeed(existing);
        return load(organizationId, track).pipe(
          Effect.flatMap(SubscriptionRef.make),
          Effect.map((created) => {
            // Deux créations concurrentes : la première enregistrée gagne.
            if (!refs.has(key)) refs.set(key, created);
            return refs.get(key) ?? created;
          }),
        );
      });

    const write = (organizationId: OrganizationId, track: Track, frame: Frame) =>
      Effect.gen(function* () {
        yield* sql`
          INSERT INTO live_frame (organization_id, track, frame, updated_at)
          VALUES (${organizationId}, ${track}, ${sql.json({ ...frame })},
                  ${new Date(frame.updatedAt)})
          ON CONFLICT (organization_id, track) DO UPDATE
            SET frame = EXCLUDED.frame, updated_at = EXCLUDED.updated_at
        `;
        const ref = yield* refFor(organizationId, track);
        yield* SubscriptionRef.set(ref, frame);
        // Les autres instances relisent l'image et la servent à leurs propres écrans.
        yield* sql.notify(FRAMES_CHANNEL, keyOf(organizationId, track));
        return frame;
      }).pipe(Effect.orDie);

    const update = (
      organizationId: OrganizationId,
      track: Track,
      transition: (frame: Frame) => Pick<Frame, "cover" | "content" | "stage">,
    ) =>
      Effect.gen(function* () {
        // La base fait autorité : une autre instance a pu publier entre-temps.
        const current = yield* load(organizationId, track);
        const now = yield* Clock.currentTimeMillis;
        return yield* write(
          organizationId,
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
          if (key === null || !refs.has(keyOf(key.organizationId, key.track))) return;
          const frame = yield* load(key.organizationId, key.track);
          const ref = refs.get(keyOf(key.organizationId, key.track));
          if (ref !== undefined) yield* SubscriptionRef.set(ref, frame);
        }),
      ),
      Effect.forkScoped,
    );

    return LiveFrames.of({
      watch: (organizationId, track) =>
        Stream.unwrap(Effect.map(refFor(organizationId, track), SubscriptionRef.changes)),
      current: (organizationId, track) => load(organizationId, track),
      publish: (organizationId, track, content, cover, stage) =>
        update(organizationId, track, () => ({ cover, content, stage })).pipe(
          Effect.withSpan("SqlLiveFrames.publish"),
        ),
      show: (organizationId, content) =>
        Effect.forEach(
          tracks,
          (track) =>
            update(organizationId, track, (frame) => ({
              cover: frame.cover,
              content,
              stage: frame.stage,
            })),
          { discard: true },
        ).pipe(Effect.withSpan("SqlLiveFrames.show")),
    });
  }),
);
