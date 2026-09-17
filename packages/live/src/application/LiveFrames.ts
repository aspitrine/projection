import {
  type Cover,
  Frame,
  type FrameContent,
  type Track,
  initialFrame,
} from "@projection/presentation/domain";
import type { OrganizationId, ProjectId } from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Stream, SubscriptionRef } from "effect";

const tracks: ReadonlyArray<Track> = ["room", "stream"];

/**
 * Image courante de chaque piste (salle, stream) de chaque projet, diffusée aux sorties.
 * En mémoire (une instance) : la régie la republie depuis la session persistée.
 */
export class LiveFrames extends Context.Service<
  LiveFrames,
  {
    /** Image courante puis chaque changement. */
    watch(organizationId: OrganizationId, projectId: ProjectId, track: Track): Stream.Stream<Frame>;
    current(
      organizationId: OrganizationId,
      projectId: ProjectId,
      track: Track,
    ): Effect.Effect<Frame>;
    /** Contenu et bouton d'urgence d'une piste en une seule image. */
    publish(
      organizationId: OrganizationId,
      projectId: ProjectId,
      track: Track,
      content: FrameContent,
      cover: Cover,
    ): Effect.Effect<Frame>;
    /** Affiche un contenu sur toutes les pistes, bouton d'urgence inchangé (test d'affichage). */
    show(
      organizationId: OrganizationId,
      projectId: ProjectId,
      content: FrameContent,
    ): Effect.Effect<void>;
  }
>()("@projection/live/LiveFrames") {
  static readonly layerMemory = Layer.effect(
    LiveFrames,
    Effect.sync(() => {
      const refs = new Map<string, SubscriptionRef.SubscriptionRef<Frame>>();

      const refFor = (organizationId: OrganizationId, projectId: ProjectId, track: Track) =>
        Effect.suspend(() => {
          const key = `${organizationId}\n${projectId}\n${track}`;
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
        projectId: ProjectId,
        track: Track,
        transition: (frame: Frame) => Pick<Frame, "cover" | "content">,
      ) =>
        Effect.gen(function* () {
          const ref = yield* refFor(organizationId, projectId, track);
          const now = yield* Clock.currentTimeMillis;
          return yield* SubscriptionRef.updateAndGet(
            ref,
            (frame) =>
              new Frame({ ...transition(frame), version: frame.version + 1, updatedAt: now }),
          );
        });

      return LiveFrames.of({
        watch: (organizationId, projectId, track) =>
          Stream.unwrap(
            Effect.map(refFor(organizationId, projectId, track), SubscriptionRef.changes),
          ),
        current: (organizationId, projectId, track) =>
          Effect.flatMap(refFor(organizationId, projectId, track), SubscriptionRef.get),
        publish: (organizationId, projectId, track, content, cover) =>
          update(organizationId, projectId, track, () => ({ cover, content })).pipe(
            Effect.withSpan("LiveFrames.publish"),
          ),
        show: (organizationId, projectId, content) =>
          Effect.forEach(
            tracks,
            (track) =>
              update(organizationId, projectId, track, (frame) => ({
                cover: frame.cover,
                content,
              })),
            { discard: true },
          ).pipe(Effect.withSpan("LiveFrames.show")),
      });
    }),
  );
}
