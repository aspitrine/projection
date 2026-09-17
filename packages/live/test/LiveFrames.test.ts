import { describe, expect, it } from "@effect/vitest";
import { OrganizationId, ProjectId } from "@projection/shared-kernel";
import { Effect, Fiber, Stream } from "effect";

import { LiveFrames } from "../src/application/LiveFrames";

const orgA = OrganizationId.make("org-a");
const orgB = OrganizationId.make("org-b");
const projectA = ProjectId.make("11111111-1111-4111-8111-111111111111");
const projectB = ProjectId.make("22222222-2222-4222-8222-222222222222");

describe("LiveFrames", () => {
  it.effect("diffuse l'image courante puis les changements d'une piste", () =>
    Effect.gen(function* () {
      const frames = yield* LiveFrames;
      const received = yield* frames
        .watch(orgA, projectA, "room")
        .pipe(Stream.take(3), Stream.runCollect, Effect.forkChild);
      yield* Effect.yieldNow;

      yield* frames.publish(
        orgA,
        projectA,
        "room",
        { _tag: "Lines", lines: ["Gloire"], caption: "Refrain" },
        "none",
        null,
      );
      yield* frames.publish(
        orgA,
        projectA,
        "room",
        { _tag: "Lines", lines: ["Gloire"], caption: "Refrain" },
        "black",
        null,
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
          projectA,
          "stream",
          { _tag: "Lines", lines: ["Gloire"], caption: null },
          "black",
          null,
        );
        expect((yield* frames.current(orgA, projectA, "room")).version).toBe(0);
        expect((yield* frames.current(orgA, projectA, "stream")).version).toBe(1);

        yield* frames.show(orgA, projectA, { _tag: "Lines", lines: ["Salle"], caption: null });
        expect(yield* frames.current(orgA, projectA, "room")).toMatchObject({ version: 1, cover: "none" });
        expect(yield* frames.current(orgA, projectA, "stream")).toMatchObject({ version: 2, cover: "black" });
        expect((yield* frames.current(orgA, projectB, "room")).version).toBe(0);
        expect((yield* frames.current(orgB, projectA, "room")).version).toBe(0);
      }).pipe(Effect.provide(LiveFrames.layerMemory)),
  );
});
