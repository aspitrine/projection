import {
  Frame,
  type FrameContent,
  type Track,
  initialFrame,
} from "@projection/presentation/domain";
import type { OrganizationId } from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Stream, SubscriptionRef } from "effect";

const tracks: ReadonlyArray<Track> = ["room", "stream"];

/**
 * Image courante de chaque piste (salle, stream) de chaque organisation, diffusée aux sorties.
 * En mémoire (une instance) : la régie la republie depuis la session persistée.
 */
export class LiveFrames extends Context.Service<
  LiveFrames,
  {
    /** Image courante puis chaque changement. */
    watch(organizationId: OrganizationId, track: Track): Stream.Stream<Frame>;
    current(organizationId: OrganizationId, track: Track): Effect.Effect<Frame>;
    /** Contenu et écran noir d'une piste en une seule image. */
    publish(
      organizationId: OrganizationId,
      track: Track,
      content: FrameContent,
      blackout: boolean,
    ): Effect.Effect<Frame>;
    /** Affiche un contenu sur toutes les pistes, écran noir inchangé (test d'affichage). */
    show(organizationId: OrganizationId, content: FrameContent): Effect.Effect<void>;
  }
>()("@projection/live/LiveFrames") {
  static readonly layerMemory = Layer.effect(
    LiveFrames,
    Effect.sync(() => {
      const refs = new Map<string, SubscriptionRef.SubscriptionRef<Frame>>();

      const refFor = (organizationId: OrganizationId, track: Track) =>
        Effect.suspend(() => {
          const key = `${organizationId}:${track}`;
          const existing = refs.get(key);
          if (existing !== undefined) return Effect.succeed(existing);
          return SubscriptionRef.make(initialFrame).pipe(
            Effect.map((created) => {
              // Deux créations concurrentes : la première enregistrée gagne.
              if (!refs.has(key)) refs.set(key, created);
              return refs.get(key) ?? created;
            }),
          );
        });

      const update = (
        organizationId: OrganizationId,
        track: Track,
        transition: (frame: Frame) => Pick<Frame, "blackout" | "content">,
      ) =>
        Effect.gen(function* () {
          const ref = yield* refFor(organizationId, track);
          const now = yield* Clock.currentTimeMillis;
          return yield* SubscriptionRef.updateAndGet(
            ref,
            (frame) =>
              new Frame({ ...transition(frame), version: frame.version + 1, updatedAt: now }),
          );
        });

      return LiveFrames.of({
        watch: (organizationId, track) =>
          Stream.unwrap(Effect.map(refFor(organizationId, track), SubscriptionRef.changes)),
        current: (organizationId, track) =>
          Effect.flatMap(refFor(organizationId, track), SubscriptionRef.get),
        publish: (organizationId, track, content, blackout) =>
          update(organizationId, track, () => ({ blackout, content })).pipe(
            Effect.withSpan("LiveFrames.publish"),
          ),
        show: (organizationId, content) =>
          Effect.forEach(
            tracks,
            (track) =>
              update(organizationId, track, (frame) => ({ blackout: frame.blackout, content })),
            { discard: true },
          ).pipe(Effect.withSpan("LiveFrames.show")),
      });
    }),
  );
}
