import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Queue, Stream } from "effect";

import { Outputs } from "../src/application/Outputs";
import { OutputRepository } from "../src/application/ports";
import { generateDisplayToken, isDisplayToken } from "../src/domain/Output";
import { FrameGatewayMemory, asActor } from "./support";

const TestLayer = Outputs.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(OutputRepository.layerMemory, FrameGatewayMemory)),
);

describe("generateDisplayToken", () => {
  it.effect("produit des tokens base64url de 256 bits, tous différents", () =>
    Effect.gen(function* () {
      const tokens = yield* Effect.all(Array.from({ length: 50 }, () => generateDisplayToken));
      expect(tokens.every(isDisplayToken)).toBe(true);
      expect(new Set(tokens).size).toBe(50);
    }),
  );
});

describe("Outputs", () => {
  it.effect("crée une seule sortie salle par organisation", () =>
    Effect.gen(function* () {
      const outputs = yield* Outputs;
      const first = yield* outputs.list.pipe(asActor("org-a"));
      const second = yield* outputs.list.pipe(asActor("org-a"));
      expect(first).toHaveLength(1);
      expect(second).toEqual(first);
      expect(first[0]).toMatchObject({ name: "Salle", type: "room", organizationId: "org-a" });
      expect((yield* outputs.list.pipe(asActor("org-b")))[0]?.id).not.toBe(first[0]?.id);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("seuls propriétaire et admin régénèrent le token ; l'ancien devient invalide", () =>
    Effect.gen(function* () {
      const outputs = yield* Outputs;
      const [output] = yield* outputs.list.pipe(asActor("org-a"));
      if (output === undefined) throw new Error("sortie manquante");

      const forbidden = yield* outputs
        .regenerateToken(output.id)
        .pipe(asActor("org-a", "operator"), Effect.flip);
      expect(forbidden._tag).toBe("Forbidden");

      const regenerated = yield* outputs.regenerateToken(output.id).pipe(asActor("org-a", "admin"));
      expect(regenerated.token).not.toBe(output.token);

      const oldToken = yield* outputs.watchDisplay(output.token).pipe(Stream.runHead, Effect.flip);
      expect(oldToken._tag).toBe("InvalidDisplayToken");

      const foreign = yield* outputs
        .regenerateToken(output.id)
        .pipe(asActor("org-b", "owner"), Effect.flip);
      expect(foreign._tag).toBe("OutputNotFound");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("un écran reçoit l'image courante puis le test d'identification", () =>
    Effect.gen(function* () {
      const outputs = yield* Outputs;
      const [output] = yield* outputs.list.pipe(asActor("org-a"));
      if (output === undefined) throw new Error("sortie manquante");

      const screen = yield* Queue.unbounded<string>();
      yield* outputs.watchDisplay(output.token).pipe(
        Stream.runForEach((display) =>
          Queue.offer(
            screen,
            display.frame.content._tag === "Lines" ? display.frame.content.lines.join(" ") : "vide",
          ),
        ),
        Effect.forkChild,
      );

      expect(yield* Queue.take(screen)).toBe("vide");
      yield* outputs.identify(output.id).pipe(asActor("org-a"));
      expect(yield* Queue.take(screen)).toBe("Salle");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("refuse un token inconnu ou mal formé", () =>
    Effect.gen(function* () {
      const outputs = yield* Outputs;
      for (const token of ["", "abc", "a".repeat(43)]) {
        const error = yield* outputs.watchDisplay(token).pipe(Stream.runHead, Effect.flip);
        expect(error._tag).toBe("InvalidDisplayToken");
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
