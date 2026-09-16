import { describe, expect, it } from "@effect/vitest";
import { parseLyrics } from "@projection/songs/domain";
import { Effect } from "effect";
import { readFileSync } from "node:fs";

import { cleanVerseText, parseVideoPsalmAgenda } from "../src/domain/VideoPsalm";
import { parseVideoPsalmValue } from "../src/domain/VideoPsalmValue";

const fixture = readFileSync(
  new URL("../../songs/test/fixtures/videopsalm/culte-synthetique.vpagd", import.meta.url),
);

describe("Lecture des fichiers VideoPsalm", () => {
  it("accepte clés non quotées, retours à la ligne bruts et nombres", () => {
    const value = parseVideoPsalmValue(
      '{Guid:"a",Tag:1,Text:"ligne 1\nligne 2",Verses:[{Text:"x"}]}',
    );
    expect(value).toEqual({
      Guid: "a",
      Tag: 1,
      Text: "ligne 1\nligne 2",
      Verses: [{ Text: "x" }],
    });
  });

  it("retire les accords et recompose les accents coupés", () => {
    expect(cleanVerseText("Je chante a[A]̀ toi, [D]lumière\n.\n   Ta bon[G]té")).toEqual([
      "Je chante à toi, lumière",
      "Ta bonté",
    ]);
    expect(cleanVerseText("[Bm][G][A][D]")).toEqual([]);
  });
});

describe("parseVideoPsalmAgenda", () => {
  it.effect("lit l'agenda synthétique : ordre, sections, rejeu du refrain", () =>
    Effect.gen(function* () {
      const agenda = parseVideoPsalmAgenda(fixture);
      if ("_tag" in agenda) throw new Error(`import refusé : ${agenda.reason}`);

      expect(agenda.songs.map((song) => song.title)).toEqual(["Lumière du matin", "Petit chant"]);

      const [first] = agenda.songs;
      expect(first).toMatchObject({
        externalId: "0000000000000000000001",
        authors: null,
        copyright: "© 2026 Projection (fixture libre)",
        key: "D",
        reference: "!TEST001",
        notes: "note ligne 1 note ligne 2",
      });
      expect(first?.lyrics).toBe(
        [
          "[Couplet 1]\nQuand le jour se lève sur la plaine\nJe regarde le ciel clair",
          "[Pré-refrain]\nEt mon cœur s'éveille",
          "[Refrain]\nJe chante à toi, lumière\nTa bonté remplit la terre",
          "[Couplet 2]\nQuand le soir descend sur la ville\nJe me souviens de ta paix",
          "[Refrain]",
          "[Pont]\nToujours, toujours\nTu es là",
          "[Refrain]",
        ].join("\n\n"),
      );

      // Les paroles produites doivent être relisibles par le domaine songs.
      const parsed = yield* parseLyrics(first?.lyrics ?? "");
      expect(parsed.arrangement).toEqual([
        "verse-1",
        "pre_chorus",
        "chorus",
        "verse-2",
        "chorus",
        "bridge",
        "chorus",
      ]);
    }),
  );

  it("refuse un fichier qui n'est pas une archive ou sans chant", () => {
    const notZip = parseVideoPsalmAgenda(new TextEncoder().encode("bonjour"));
    expect("reason" in notZip && notZip.reason).toBe("NotAnArchive");
  });
});
