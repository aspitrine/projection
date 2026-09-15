import { describe, expect, it } from "@effect/vitest";
import {
  Actor,
  CurrentActor,
  OrganizationId,
  TextSlideId,
  UserId,
} from "@projection/shared-kernel";
import { Effect, Layer } from "effect";

import { TextSlideRepository } from "../src/application/TextSlideRepository";
import { TextSlides } from "../src/application/TextSlides";
import { TextSlideInput } from "../src/domain/TextSlide";

const TestLayer = TextSlides.layer.pipe(Layer.provideMerge(TextSlideRepository.layerMemory));

const inOrganization = (organizationId: string) =>
  Effect.provideService(
    CurrentActor,
    new Actor({
      userId: UserId.make("user"),
      organizationId: OrganizationId.make(organizationId),
      role: "operator",
    }),
  );

const input = (overrides: Partial<TextSlideInput> = {}) =>
  new TextSlideInput({
    title: "Annonces",
    source: "  # Annonces\nCulte à **10 h**  ",
    ...overrides,
  });

describe("TextSlides", () => {
  it.effect("crée, lit, met à jour et supprime une diapo", () =>
    Effect.gen(function* () {
      const slides = yield* TextSlides;
      const created = yield* slides.create(input()).pipe(inOrganization("org-a"));
      expect(created.source).toBe("# Annonces\nCulte à **10 h**");

      const updated = yield* slides
        .update(created.id, input({ title: "Annonces du jour", source: "Bienvenue" }))
        .pipe(inOrganization("org-a"));
      expect(updated.createdAt).toBe(created.createdAt);
      expect(yield* slides.get(created.id).pipe(inOrganization("org-a"))).toEqual(updated);

      yield* slides.remove(created.id).pipe(inOrganization("org-a"));
      const error = yield* slides.get(created.id).pipe(inOrganization("org-a"), Effect.flip);
      expect(error._tag).toBe("TextSlideNotFound");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("refuse un contenu vide ou réduit à des marqueurs", () =>
    Effect.gen(function* () {
      const slides = yield* TextSlides;
      for (const source of ["", "   \n\n", "# \n- "]) {
        const error = yield* slides
          .create(input({ source }))
          .pipe(inOrganization("org-a"), Effect.flip);
        expect(error._tag).toBe("EmptyTextSlide");
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("isole les organisations et recherche par titre", () =>
    Effect.gen(function* () {
      const slides = yield* TextSlides;
      const created = yield* slides
        .create(input({ title: "Prière d'ouverture" }))
        .pipe(inOrganization("org-a"));
      yield* slides.create(input({ title: "Offrande" })).pipe(inOrganization("org-a"));

      expect(yield* slides.list(null).pipe(inOrganization("org-b"))).toEqual([]);
      expect((yield* slides.get(created.id).pipe(inOrganization("org-b"), Effect.flip))._tag).toBe(
        "TextSlideNotFound",
      );
      expect(
        (yield* slides.list("PRIERE").pipe(inOrganization("org-a"))).map((slide) => slide.title),
      ).toEqual(["Prière d'ouverture"]);
      const unknown = TextSlideId.make("00000000-0000-4000-8000-000000000000");
      expect((yield* slides.remove(unknown).pipe(inOrganization("org-a"), Effect.flip))._tag).toBe(
        "TextSlideNotFound",
      );
    }).pipe(Effect.provide(TestLayer)),
  );
});
