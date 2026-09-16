import { describe, expect, it } from "@effect/vitest";
import { Effect, Stream } from "effect";

import { withHeartbeat, withHeartbeatTimeout } from "../src/Heartbeat";

describe("withHeartbeat", () => {
  it.live("réémet la dernière valeur entre deux changements", () =>
    Effect.gen(function* () {
      // Une seule valeur, puis un silence : les battements la répètent.
      const source = Stream.make("a").pipe(Stream.concat(Stream.never));
      const values = yield* withHeartbeat(source, "10 millis").pipe(
        Stream.take(3),
        Stream.runCollect,
      );
      expect(values).toEqual(["a", "a", "a"]);
    }),
  );

  it.live("ne bat pas avant la première valeur", () =>
    Effect.gen(function* () {
      const source = Stream.fromEffect(Effect.delay(Effect.succeed("tardif"), "50 millis"));
      const values = yield* withHeartbeat(source, "10 millis").pipe(
        Stream.take(1),
        Stream.runCollect,
      );
      expect(values).toEqual(["tardif"]);
    }),
  );

  it.live("s'arrête avec le flux qu'il accompagne", () =>
    Effect.gen(function* () {
      const values = yield* withHeartbeat(Stream.make(1, 2), "1 hour").pipe(Stream.runCollect);
      expect(values).toEqual([1, 2]);
    }),
  );
});

describe("withHeartbeatTimeout", () => {
  it.live("termine un flux devenu silencieux", () =>
    Effect.gen(function* () {
      const source = Stream.make("a").pipe(Stream.concat(Stream.never));
      const values = yield* withHeartbeatTimeout(source, "20 millis").pipe(Stream.runCollect);
      expect(values).toEqual(["a"]);
    }),
  );

  it.live("laisse passer un flux qui bat", () =>
    Effect.gen(function* () {
      const battant = withHeartbeat(Stream.make("a").pipe(Stream.concat(Stream.never)), "5 millis");
      const values = yield* withHeartbeatTimeout(battant, "50 millis").pipe(
        Stream.take(4),
        Stream.runCollect,
      );
      expect(values).toEqual(["a", "a", "a", "a"]);
    }),
  );
});
