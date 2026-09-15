import { Frame, type FrameContent, initialFrame } from "@projection/presentation/domain";
import type { OrganizationId } from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Stream, SubscriptionRef } from "effect";

/**
 * Image courante de chaque organisation, diffusée à toutes ses sorties.
 * En mémoire (une instance) : la régie la republie depuis la session persistée.
 */
export class LiveFrames extends Context.Service<
  LiveFrames,
  {
    /** Image courante puis chaque changement. */
    watch(organizationId: OrganizationId): Stream.Stream<Frame>;
    current(organizationId: OrganizationId): Effect.Effect<Frame>;
    show(organizationId: OrganizationId, content: FrameContent): Effect.Effect<Frame>;
    setBlackout(organizationId: OrganizationId, blackout: boolean): Effect.Effect<Frame>;
    /** Contenu et écran noir en une seule image. */
    publish(
      organizationId: OrganizationId,
      content: FrameContent,
      blackout: boolean,
    ): Effect.Effect<Frame>;
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
        transition: (frame: Frame) => Pick<Frame, "blackout" | "content">,
      ) =>
        Effect.gen(function* () {
          const ref = yield* refFor(organizationId);
          const now = yield* Clock.currentTimeMillis;
          return yield* SubscriptionRef.updateAndGet(
            ref,
            (frame) =>
              new Frame({
                ...transition(frame),
                version: frame.version + 1,
                updatedAt: now,
              }),
          );
        });

      return LiveFrames.of({
        watch: (organizationId) =>
          Stream.unwrap(Effect.map(refFor(organizationId), SubscriptionRef.changes)),
        current: (organizationId) => Effect.flatMap(refFor(organizationId), SubscriptionRef.get),
        show: (organizationId, content) =>
          update(organizationId, (frame) => ({ blackout: frame.blackout, content })).pipe(
            Effect.withSpan("LiveFrames.show"),
          ),
        setBlackout: (organizationId, blackout) =>
          update(organizationId, (frame) => ({ blackout, content: frame.content })).pipe(
            Effect.withSpan("LiveFrames.setBlackout"),
          ),
        publish: (organizationId, content, blackout) =>
          update(organizationId, () => ({ blackout, content })).pipe(
            Effect.withSpan("LiveFrames.publish"),
          ),
      });
    }),
  );
}
