import { describe, expect, it } from "@effect/vitest";
import { Effect, Queue } from "effect";
import { RpcTest } from "effect/unstable/rpc";

import { LiveRpcs } from "../src/api/contract";
import { LiveLive } from "../src/server";

describe("LiveRpcs", () => {
  it.effect("LiveWatch émet l'état courant puis chaque changement", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(LiveRpcs);
      const watch = yield* client.LiveWatch(undefined, { asQueue: true });

      expect((yield* Queue.take(watch)).version).toBe(0);

      yield* client.LiveGoTo({ slideIndex: 3 });
      const next = yield* Queue.take(watch);
      expect(next.slideIndex).toBe(3);
      expect(next.version).toBe(1);
    }).pipe(Effect.provide(LiveLive)),
  );

  it.effect("un nouvel abonnement reçoit l'état complet courant (resynchronisation)", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(LiveRpcs);
      yield* client.LiveGoTo({ slideIndex: 5 });
      yield* client.LiveToggleBlackout();

      const watch = yield* client.LiveWatch(undefined, { asQueue: true });
      const state = yield* Queue.take(watch);
      expect(state.slideIndex).toBe(5);
      expect(state.blackout).toBe(true);
      expect(state.version).toBe(2);
    }).pipe(Effect.provide(LiveLive)),
  );
});
