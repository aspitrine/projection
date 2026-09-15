import { describe, expect, it } from "@effect/vitest";
import { Translation, Verse } from "@projection/bible/domain";
import { Bible } from "@projection/bible/server";
import { DeckSource } from "@projection/live/server";
import { ProjectInput } from "@projection/projects/domain";
import { Projects } from "@projection/projects/server";
import {
  Actor,
  CurrentActor,
  OrganizationId,
  ProjectId,
  SongId,
  UserId,
} from "@projection/shared-kernel";
import { TextSlideInput } from "@projection/slides/domain";
import { TextSlides } from "@projection/slides/server";
import { SongInput } from "@projection/songs/domain";
import { Songs } from "@projection/songs/server";
import { Effect, Layer } from "effect";

import { ScriptureRepository } from "../../../packages/bible/src/application/ScriptureRepository";
import { ProjectRepository } from "../../../packages/projects/src/application/ProjectRepository";
import { TextSlideRepository } from "../../../packages/slides/src/application/TextSlideRepository";
import { SongRepository } from "../../../packages/songs/src/application/SongRepository";
import { DeckSourceLive } from "../src/server/deck-source";

const lsg = new Translation({
  id: "lsg1910",
  code: "LSG",
  name: "Louis Segond 1910",
  language: "fr",
  license: "Domaine public",
});

const ServicesLive = Layer.mergeAll(
  Songs.layer.pipe(Layer.provide(SongRepository.layerMemory)),
  Projects.layer.pipe(Layer.provide(ProjectRepository.layerMemory)),
  TextSlides.layer.pipe(Layer.provide(TextSlideRepository.layerMemory)),
  Bible.layer.pipe(
    Layer.provide(
      ScriptureRepository.layerMemory([lsg], {
        lsg1910: [
          new Verse({ book: "JHN", chapter: 3, verse: 16, text: "Car Dieu a tant aimé le monde." }),
          new Verse({
            book: "JHN",
            chapter: 3,
            verse: 17,
            text: "Dieu n'a pas envoyé son Fils pour juger.",
          }),
        ],
      }),
    ),
  ),
);

const TestLayer = DeckSourceLive.pipe(Layer.provideMerge(ServicesLive));

const asActor = Effect.provideService(
  CurrentActor,
  new Actor({
    userId: UserId.make("u"),
    organizationId: OrganizationId.make("org"),
    role: "operator",
  }),
);

describe("DeckSourceLive", () => {
  it.effect("résout chants, passages, diapos texte, écrans vides et éléments supprimés", () =>
    Effect.gen(function* () {
      const songs = yield* Songs;
      const slides = yield* TextSlides;
      const projects = yield* Projects;
      const decks = yield* DeckSource;

      const song = yield* songs.create(
        new SongInput({
          title: "Il est bon",
          authors: null,
          copyright: null,
          ccli: null,
          lyrics: "[Couplet 1]\nL1\nL2\nL3\nL4\nL5\n[Refrain]\nR1\n[Refrain]",
        }),
      );
      const textSlide = yield* slides.create(
        new TextSlideInput({ title: "Annonces", source: "# Annonces" }),
      );
      const project = yield* projects.create(new ProjectInput({ name: "Culte", date: null }));
      for (const draft of [
        { _tag: "Song", songId: song.id },
        { _tag: "Scripture", translationId: "lsg1910", reference: "Jean 3.16-17" },
        { _tag: "TextSlide", textSlideId: textSlide.id },
        { _tag: "Blank" },
        { _tag: "Song", songId: SongId.make("00000000-0000-4000-8000-000000000000") },
      ] as const) {
        yield* projects.addItem(project.id, draft, null);
      }

      const deck = yield* decks.resolve(project.id);
      expect(deck.projectName).toBe("Culte");
      const [songItem, scripture, textItem, blank, missing] = deck.items;

      expect(songItem).toMatchObject({ kind: "Song", title: "Il est bon", missing: false });
      expect(songItem?.slides.map((slide) => slide.label)).toEqual([
        "Couplet 1 (1/2)",
        "Couplet 1 (2/2)",
        "Refrain",
        "Refrain",
      ]);
      expect(songItem?.slides[0]?.content).toEqual({
        _tag: "Lines",
        lines: ["L1", "L2", "L3"],
        caption: "Couplet 1",
      });

      expect(scripture).toMatchObject({ kind: "Scripture", title: "Jean 3.16-17 (LSG)" });
      expect(scripture?.slides).toHaveLength(1);
      expect(scripture?.slides[0]?.label).toBe("Jean 3.16");

      expect(textItem?.slides[0]?.content).toEqual({
        _tag: "Rich",
        source: "# Annonces",
        caption: "Annonces",
      });
      expect(blank?.slides[0]?.content).toEqual({ _tag: "Blank" });
      expect(missing).toMatchObject({ kind: "Song", missing: true, slides: [] });

      const unknown = yield* decks
        .resolve(ProjectId.make("11111111-1111-4111-8111-111111111111"))
        .pipe(Effect.flip);
      expect(unknown._tag).toBe("LiveProjectNotFound");
    }).pipe(asActor, Effect.provide(TestLayer)),
  );
});
