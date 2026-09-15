import { Clock, Context, Effect, Layer, Stream, SubscriptionRef } from "effect";

import { goTo, initialLiveState, type LiveState, toggleBlackout } from "../domain/LiveState";

export class LiveSessionStore extends Context.Service<
  LiveSessionStore,
  {
    /** État courant puis chaque changement. */
    readonly changes: Stream.Stream<LiveState>;
    goTo(slideIndex: number): Effect.Effect<LiveState>;
    readonly toggleBlackout: Effect.Effect<LiveState>;
  }
>()("@projection/live/LiveSessionStore") {
  /** Spike T0.2 : état en mémoire, perdu au redémarrage. Persistance Postgres en T1.8. */
  static readonly layerMemory = Layer.effect(
    LiveSessionStore,
    Effect.gen(function* () {
      const ref = yield* SubscriptionRef.make(initialLiveState);

      const apply = (transition: (state: LiveState, now: number) => LiveState) =>
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((now) =>
            SubscriptionRef.updateAndGet(ref, (state) => transition(state, now)),
          ),
        );

      return LiveSessionStore.of({
        changes: SubscriptionRef.changes(ref),
        goTo: Effect.fn("LiveSessionStore.goTo")((slideIndex: number) =>
          apply((state, now) => goTo(state, slideIndex, now)),
        ),
        toggleBlackout: apply(toggleBlackout).pipe(
          Effect.withSpan("LiveSessionStore.toggleBlackout"),
        ),
      });
    }),
  );
}
