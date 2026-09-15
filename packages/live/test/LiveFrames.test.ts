import { describe, expect, it } from "@effect/vitest";
import { OrganizationId } from "@projection/shared-kernel";
import { Effect, Fiber, Stream } from "effect";

import { LiveFrames } from "../src/application/LiveFrames";

const orgA = OrganizationId.make("org-a");
const orgB = OrganizationId.make("org-b");

describe("LiveFrames", () => {
  it.effect("diffuse l'image courante puis les changements", () =>
    Effect.gen(function* () {
      const frames = yield* LiveFrames;
      const received = yield* frames
        .watch(orgA)
        .pipe(Stream.take(3), Stream.runCollect, Effect.forkChild);
      yield* Effect.yieldNow;

      yield* frames.show(orgA, { _tag: "Lines", lines: ["Gloire à Dieu"], caption: "Refrain" });
      yield* frames.setBlackout(orgA, true);

      const [initial, shown, blackout] = yield* Fiber.join(received);
      expect(initial?.content._tag).toBe("Blank");
      expect(shown?.content).toEqual({
        _tag: "Lines",
        lines: ["Gloire à Dieu"],
        caption: "Refrain",
      });
      expect(blackout).toMatchObject({ blackout: true, version: 2 });
    }).pipe(Effect.provide(LiveFrames.layerMemory)),
  );

  it.effect("isole les organisations", () =>
    Effect.gen(function* () {
      const frames = yield* LiveFrames;
      yield* frames.show(orgA, { _tag: "Blank" });
      yield* frames.setBlackout(orgA, true);
      expect(yield* frames.current(orgB)).toMatchObject({ version: 0, blackout: false });
      expect((yield* frames.current(orgA)).version).toBe(2);
    }).pipe(Effect.provide(LiveFrames.layerMemory)),
  );
});
