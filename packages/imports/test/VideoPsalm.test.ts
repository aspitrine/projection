import { describe, expect, it } from "@effect/vitest";
import { parseLyrics } from "@projection/songs/domain";
import { Effect } from "effect";
import { readFileSync } from "node:fs";

import { zipSync } from "fflate";

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

  it.effect("numérote les sections homonymes, lit Composer et les tags 5 et 6", () =>
    Effect.gen(function* () {
      const song = [
        '{Guid:"g1",Text:"Deux refrains",Composer:"NV Junior",Verses:[',
        '{Tag:5,Text:"[G][D]"}, ',
        '{Text:"[G]Couplet un"}, ',
        '{Tag:1,Text:"Premier refrain"}, ',
        '{Tag:1,Text:"Premier refrain"}, ',
        '{Tag:1,Text:"Second refrain"}, ',
        '{Tag:3,Text:"Premier pont"}, ',
        '{Tag:3,Text:"Second pont"}, ',
        '{Tag:6,Text:"Phrase finale"}]}',
      ].join("");
      const archive = zipSync({
        "Version.json": new TextEncoder().encode("2"),
        "Song_0.json": new TextEncoder().encode(song),
      });

      const agenda = parseVideoPsalmAgenda(archive);
      if ("_tag" in agenda) throw new Error(`import refusé : ${agenda.reason}`);
      const imported = agenda.songs[0];
      expect(imported?.authors).toBe("NV Junior");
      expect(imported?.lyrics).toBe(
        [
          "[Couplet 1]\nCouplet un",
          "[Refrain]\nPremier refrain",
          "[Refrain]",
          "[Refrain 2]\nSecond refrain",
          "[Pont]\nPremier pont",
          "[Pont 2]\nSecond pont",
          "[Tag]\nPhrase finale",
        ].join("\n\n"),
      );

      // Deux sections de même tag mais de texte différent restent acceptées.
      const parsed = yield* parseLyrics(imported?.lyrics ?? "");
      expect(parsed.arrangement).toEqual([
        "verse-1",
        "chorus",
        "chorus",
        "chorus-2",
        "bridge",
        "bridge-2",
        "tag",
      ]);
    }),
  );
});
