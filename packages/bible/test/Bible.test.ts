import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { Bible } from "../src/application/Bible";
import { ScriptureRepository } from "../src/application/ScriptureRepository";
import { Translation, Verse } from "../src/domain/Scripture";

const lsg = new Translation({
  id: "lsg1910",
  code: "LSG",
  name: "Louis Segond 1910",
  language: "fr",
  license: "Domaine public",
});

const verse = (chapter: number, number: number) =>
  new Verse({ book: "JHN", chapter, verse: number, text: `Jean ${chapter}.${number}` });

const TestLayer = Bible.layer.pipe(
  Layer.provide(
    ScriptureRepository.layerMemory([lsg], {
      lsg1910: [verse(4, 1), verse(3, 16), verse(3, 17), verse(3, 18), verse(4, 2)],
    }),
  ),
);

describe("Bible.lookup", () => {
  it.effect("renvoie le passage ordonné avec sa référence formatée", () =>
    Effect.gen(function* () {
      const bible = yield* Bible;
      const passage = yield* bible.lookup("lsg1910", "jn 3:16-17");
      expect(passage.label).toBe("Jean 3.16-17");
      expect(passage.translation.code).toBe("LSG");
      expect(passage.verses.map((v) => v.text)).toEqual(["Jean 3.16", "Jean 3.17"]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("couvre un passage sur deux chapitres et un chapitre entier", () =>
    Effect.gen(function* () {
      const bible = yield* Bible;
      expect((yield* bible.lookup("lsg1910", "Jean 3.18-4.1")).verses).toHaveLength(2);
      expect((yield* bible.lookup("lsg1910", "Jean 4")).verses.map((v) => v.verse)).toEqual([1, 2]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("signale une référence invalide, un passage absent ou une traduction inconnue", () =>
    Effect.gen(function* () {
      const bible = yield* Bible;
      expect(yield* bible.lookup("lsg1910", "Mormon 1").pipe(Effect.flip)).toMatchObject({
        _tag: "InvalidReference",
        reason: "UnknownBook",
      });
      expect(yield* bible.lookup("lsg1910", "Jean 99").pipe(Effect.flip)).toMatchObject({
        _tag: "PassageNotFound",
        label: "Jean 99",
      });
      expect(yield* bible.lookup("kjv", "Jean 3.16").pipe(Effect.flip)).toMatchObject({
        _tag: "UnknownTranslation",
      });
    }).pipe(Effect.provide(TestLayer)),
  );
});

describe("Bible.search", () => {
  const withText = (chapter: number, number: number, text: string) =>
    new Verse({ book: "JHN", chapter, verse: number, text });

  const SearchLayer = Bible.layer.pipe(
    Layer.provide(
      ScriptureRepository.layerMemory([lsg], {
        lsg1910: [
          withText(3, 16, "Car Dieu a tant aimé le monde"),
          withText(3, 17, "Dieu n'a pas envoyé son Fils pour juger le monde"),
          withText(4, 1, "Le Seigneur sut que les pharisiens"),
        ],
      }),
    ),
  );

  it.effect("cherche sans casse ni accents et rend la référence de chaque verset", () =>
    Effect.gen(function* () {
      const bible = yield* Bible;
      const found = yield* bible.search("lsg1910", "AIME");
      expect(found.map((match) => match.label)).toEqual(["Jean 3.16"]);
      expect(found[0]?.verse.text).toContain("aimé le monde");

      expect((yield* bible.search("lsg1910", "monde")).map((m) => m.label)).toEqual([
        "Jean 3.16",
        "Jean 3.17",
      ]);
      // La limite borne le nombre de résultats rendus.
      expect(yield* bible.search("lsg1910", "monde", 1)).toHaveLength(1);
    }).pipe(Effect.provide(SearchLayer)),
  );

  it.effect("ignore une recherche trop courte et refuse une traduction inconnue", () =>
    Effect.gen(function* () {
      const bible = yield* Bible;
      expect(yield* bible.search("lsg1910", " a ")).toEqual([]);
      const unknown = yield* bible.search("inconnue", "monde").pipe(Effect.flip);
      expect(unknown._tag).toBe("UnknownTranslation");
    }).pipe(Effect.provide(SearchLayer)),
  );
});
