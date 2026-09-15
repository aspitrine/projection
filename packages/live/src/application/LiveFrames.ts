import { Frame, type FrameContent, initialFrame } from "@projection/presentation/domain";
import type { OrganizationId } from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Stream, SubscriptionRef } from "effect";

/**
 * Image courante de chaque organisation, diffusée à toutes ses sorties.
 * En mémoire pour l'instant (une instance) ; persistance et pilotage par la régie en T1.8.
 */
export class LiveFrames extends Context.Service<
  LiveFrames,
  {
    /** Image courante puis chaque changement. */
    watch(organizationId: OrganizationId): Stream.Stream<Frame>;
    current(organizationId: OrganizationId): Effect.Effect<Frame>;
    show(organizationId: OrganizationId, content: FrameContent): Effect.Effect<Frame>;
    setBlackout(organizationId: OrganizationId, blackout: boolean): Effect.Effect<Frame>;
  }
>()("@projection/live/LiveFrames") {
  static readonly layerMemory = Layer.effect(
    LiveFrames,
    Effect.sync(() => {
      const sessions = new Map<OrganizationId, SubscriptionRef.SubscriptionRef<Frame>>();

      const refFor = (organizationId: OrganizationId) =>
        Effect.suspend(() => {
          const existing = sessions.get(organizationId);
          if (existing !== undefined) return Effect.succeed(existing);
          return SubscriptionRef.make(initialFrame).pipe(
            Effect.map((created) => {
              // Deux créations concurrentes : la première enregistrée gagne.
              if (!sessions.has(organizationId)) sessions.set(organizationId, created);
              return sessions.get(organizationId) ?? created;
            }),
          );
        });

      const update = (
        organizationId: OrganizationId,
        transition: (frame: Frame, now: number) => Frame,
      ) =>
        Effect.gen(function* () {
          const ref = yield* refFor(organizationId);
          const now = yield* Clock.currentTimeMillis;
          return yield* SubscriptionRef.updateAndGet(ref, (frame) => transition(frame, now));
        });

      return LiveFrames.of({
        watch: (organizationId) =>
          Stream.unwrap(Effect.map(refFor(organizationId), SubscriptionRef.changes)),
        current: (organizationId) => Effect.flatMap(refFor(organizationId), SubscriptionRef.get),
        show: (organizationId, content) =>
          update(
            organizationId,
            (frame, now) =>
              new Frame({ ...frame, version: frame.version + 1, content, updatedAt: now }),
          ).pipe(Effect.withSpan("LiveFrames.show")),
        setBlackout: (organizationId, blackout) =>
          update(
            organizationId,
            (frame, now) =>
              new Frame({ ...frame, version: frame.version + 1, blackout, updatedAt: now }),
          ).pipe(Effect.withSpan("LiveFrames.setBlackout")),
      });
    }),
  );
}
