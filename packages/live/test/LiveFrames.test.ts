import { describe, expect, it } from "@effect/vitest";
import { OrganizationId } from "@projection/shared-kernel";
import { Effect, Fiber, Stream } from "effect";

import { LiveFrames } from "../src/application/LiveFrames";

const orgA = OrganizationId.make("org-a");
const orgB = OrganizationId.make("org-b");

describe("LiveFrames", () => {
  it.effect("diffuse l'image courante puis les changements d'une piste", () =>
    Effect.gen(function* () {
      const frames = yield* LiveFrames;
      const received = yield* frames
        .watch(orgA, "room")
        .pipe(Stream.take(3), Stream.runCollect, Effect.forkChild);
      yield* Effect.yieldNow;

      yield* frames.publish(
        orgA,
        "room",
        { _tag: "Lines", lines: ["Gloire"], caption: "Refrain" },
        "none",
      );
      yield* frames.publish(
        orgA,
        "room",
        { _tag: "Lines", lines: ["Gloire"], caption: "Refrain" },
        "black",
      );

      const [initial, shown, blackout] = yield* Fiber.join(received);
      expect(initial?.content._tag).toBe("Blank");
      expect(shown?.content).toEqual({ _tag: "Lines", lines: ["Gloire"], caption: "Refrain" });
      expect(blackout).toMatchObject({ cover: "black", version: 2 });
    }).pipe(Effect.provide(LiveFrames.layerMemory)),
  );

  it.effect(
    "isole les pistes et les organisations ; le test d'affichage touche toutes les pistes",
    () =>
      Effect.gen(function* () {
        const frames = yield* LiveFrames;
        yield* frames.publish(
          orgA,
          "stream",
          { _tag: "Lines", lines: ["Gloire"], caption: null },
          "black",
        );
        expect((yield* frames.current(orgA, "room")).version).toBe(0);
        expect((yield* frames.current(orgA, "stream")).version).toBe(1);

        yield* frames.show(orgA, { _tag: "Lines", lines: ["Salle"], caption: null });
        expect(yield* frames.current(orgA, "room")).toMatchObject({ version: 1, cover: "none" });
        expect(yield* frames.current(orgA, "stream")).toMatchObject({ version: 2, cover: "black" });
        expect((yield* frames.current(orgB, "room")).version).toBe(0);
      }).pipe(Effect.provide(LiveFrames.layerMemory)),
  );
});
