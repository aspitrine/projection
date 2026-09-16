import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";

import { Outputs } from "../src/application/Outputs";
import { OutputRepository } from "../src/application/ports";
import { SlideTheme } from "@projection/presentation/domain";

import { defaultSplittingSettings, trackOf } from "../src/domain/Output";
import { defaultThemeFor } from "../src/domain/Themes";
import { BrandingSourceMemory, FrameGatewayMemory, asActor } from "./support";

const TestLayer = Outputs.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(OutputRepository.layerMemory, FrameGatewayMemory, BrandingSourceMemory),
  ),
);

describe("Types de sortie", () => {
  it("la salle pilote salle et retour, le stream a sa piste", () => {
    expect(trackOf("room")).toBe("room");
    expect(trackOf("stage")).toBe("room");
    expect(trackOf("stream")).toBe("stream");
  });
});

describe("Gestion des sorties", () => {
  it.effect("propriétaire et admin créent, renomment et suppriment ; pas les opérateurs", () =>
    Effect.gen(function* () {
      const outputs = yield* Outputs;
      const [room] = yield* outputs.list.pipe(asActor("org-a"));
      if (room === undefined) throw new Error("sortie manquante");

      const forbidden = yield* outputs
        .create({ name: "Stream", type: "stream" })
        .pipe(asActor("org-a", "operator"), Effect.flip);
      expect(forbidden._tag).toBe("Forbidden");

      const stream = yield* outputs
        .create({ name: "Stream YouTube", type: "stream" })
        .pipe(asActor("org-a", "admin"));
      const stage = yield* outputs
        .create({ name: "Retour", type: "stage" })
        .pipe(asActor("org-a", "owner"));
      expect((yield* outputs.list.pipe(asActor("org-a"))).map((output) => output.type)).toEqual([
        "room",
        "stream",
        "stage",
      ]);

      const renamed = yield* outputs
        .rename(stage.id, "Retour musiciens")
        .pipe(asActor("org-a", "admin"));
      expect(renamed).toMatchObject({
        name: "Retour musiciens",
        type: "stage",
        token: stage.token,
      });

      const foreign = yield* outputs
        .rename(stage.id, "Piratage")
        .pipe(asActor("org-b", "owner"), Effect.flip);
      expect(foreign._tag).toBe("OutputNotFound");

      // L'écran stream connaît son type.
      const display = yield* outputs.watchDisplay(stream.token).pipe(Stream.runHead);
      expect(display._tag === "Some" && display.value.outputType).toBe("stream");
      expect(display._tag === "Some" && display.value.branding).toEqual({
        name: "Église org-a",
        logoUrl: null,
      });

      yield* outputs.remove(stream.id).pipe(asActor("org-a", "admin"));
      yield* outputs.remove(stage.id).pipe(asActor("org-a", "admin"));
      const last = yield* outputs.remove(room.id).pipe(asActor("org-a", "admin"), Effect.flip);
      expect(last._tag).toBe("LastOutput");
      expect(yield* outputs.list.pipe(asActor("org-a"))).toHaveLength(1);

      const removedToken = yield* outputs
        .watchDisplay(stream.token)
        .pipe(Stream.runHead, Effect.flip);
      expect(removedToken._tag).toBe("InvalidDisplayToken");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("découpage par défaut, modifiable par propriétaire/admin, isolé par organisation", () =>
    Effect.gen(function* () {
      const outputs = yield* Outputs;
      expect(yield* outputs.splitting.pipe(asActor("org-a"))).toEqual(defaultSplittingSettings);

      const settings = {
        room: { songMaxLines: 6, scriptureMaxCharacters: 400 },
        stream: { songMaxLines: 1, scriptureMaxCharacters: 90 },
      };
      const forbidden = yield* outputs
        .updateSplitting(settings)
        .pipe(asActor("org-a", "operator"), Effect.flip);
      expect(forbidden._tag).toBe("Forbidden");

      yield* outputs.updateSplitting(settings).pipe(asActor("org-a", "admin"));
      expect(yield* outputs.splitting.pipe(asActor("org-a"))).toEqual(settings);
      expect(yield* outputs.splitting.pipe(asActor("org-b"))).toEqual(defaultSplittingSettings);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "thème par sortie : personnalisation, refus aux opérateurs, retour aux valeurs par défaut",
    () =>
      Effect.gen(function* () {
        const outputs = yield* Outputs;
        const [room] = yield* outputs.list.pipe(asActor("org-a"));
        if (room === undefined) throw new Error("sortie manquante");
        expect(room.theme).toBeNull();

        const forbidden = yield* outputs
          .setTheme(room.id, defaultThemeFor("room"))
          .pipe(asActor("org-a", "operator"), Effect.flip);
        expect(forbidden._tag).toBe("Forbidden");

        const custom = new SlideTheme({
          ...defaultThemeFor("room"),
          background: "#102030",
          transitionMs: 0,
        });
        const themed = yield* outputs.setTheme(room.id, custom).pipe(asActor("org-a", "admin"));
        expect(themed.theme).toEqual(custom);

        // L'écran reçoit le thème résolu, sans avoir à connaître les valeurs par défaut.
        const display = yield* outputs.watchDisplay(room.token).pipe(Stream.runHead);
        expect(display._tag === "Some" && display.value.theme.background).toBe("#102030");

        const reset = yield* outputs.setTheme(room.id, null).pipe(asActor("org-a", "owner"));
        expect(reset.theme).toBeNull();
        const afterReset = yield* outputs.watchDisplay(room.token).pipe(Stream.runHead);
        expect(afterReset._tag === "Some" && afterReset.value.theme).toEqual(
          defaultThemeFor("room"),
        );

        const missing = yield* outputs
          .setTheme(room.id, custom)
          .pipe(asActor("org-b", "owner"), Effect.flip);
        expect(missing._tag).toBe("OutputNotFound");
      }).pipe(Effect.provide(TestLayer)),
  );
});
