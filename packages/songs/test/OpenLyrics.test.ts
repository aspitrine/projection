import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { parseLyrics } from "../src/domain/Lyrics";
import { parseOpenLyrics, sectionLabelOf } from "../src/domain/OpenLyrics";

const song = (body: string, properties = "<titles><title>Chant test</title></titles>") =>
  `<?xml version='1.0' encoding='utf8'?>
<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.8">
  <properties>${properties}</properties>
  <lyrics>${body}</lyrics>
</song>`;

describe("sectionLabelOf", () => {
  it("traduit les noms de sections OpenLyrics", () => {
    expect(["v1", "V2", "c", "c2", "p1", "b", "i", "e", "t"].map(sectionLabelOf)).toEqual([
      "Couplet 1",
      "Couplet 2",
      "Refrain",
      "Refrain 2",
      "Pré-refrain 1",
      "Pont",
      "Intro",
      "Fin",
      "Tag",
    ]);
    expect(sectionLabelOf("solo")).toBe("solo");
  });
});

describe("parseOpenLyrics", () => {
  it.effect("retire les accords, suit l'ordre de passage et lit les métadonnées", () =>
    Effect.gen(function* () {
      const imported = parseOpenLyrics(
        song(
          [
            '<verse name="v1"><lines><chord name="A" />Première ligne<br/>Deuxième ligne</lines></verse>',
            '<verse name="c"><lines>Refrain chan<chord name="D" />té</lines></verse>',
            '<verse name="v2"><lines>Autre couplet</lines></verse>',
          ].join(""),
          [
            "<titles><title>Ta paix</title></titles>",
            "<authors><author>Alice</author><author>Bob</author></authors>",
            "<copyright>© 2026 Test</copyright>",
            "<ccliNo>12345</ccliNo>",
            "<verseOrder>v1 c v2 c</verseOrder>",
          ].join(""),
        ),
        "fichier",
      );

      expect(imported).toMatchObject({
        title: "Ta paix",
        authors: "Alice, Bob",
        copyright: "© 2026 Test",
        ccli: "12345",
      });
      expect(imported?.lyrics).toBe(
        [
          "[Couplet 1]\nPremière ligne\nDeuxième ligne",
          "[Refrain]\nRefrain chanté",
          "[Couplet 2]\nAutre couplet",
          "[Refrain]",
        ].join("\n\n"),
      );

      const parsed = yield* parseLyrics(imported?.lyrics ?? "");
      expect(parsed.arrangement).toEqual(["verse-1", "chorus", "verse-2", "chorus"]);
    }),
  );

  it("accepte un bloc de lignes par ligne, et garde les sections hors ordre de passage", () => {
    const imported = parseOpenLyrics(
      song(
        [
          '<verse name="v1"><lines>Ligne un</lines><lines>Ligne deux</lines></verse>',
          '<verse name="b"><lines>Le pont</lines></verse>',
        ].join(""),
        "<titles><title>Deux blocs</title></titles><verseOrder>v1</verseOrder>",
      ),
      "fichier",
    );
    expect(imported?.lyrics).toBe("[Couplet 1]\nLigne un\nLigne deux\n\n[Pont]\nLe pont");
  });

  it("utilise le nom du fichier sans titre et refuse un fichier sans parole", () => {
    expect(
      parseOpenLyrics(song('<verse name="v1"><lines>Texte</lines></verse>', ""), "Mon chant")
        ?.title,
    ).toBe("Mon chant");
    expect(parseOpenLyrics(song(""), "x")).toBeNull();
    expect(parseOpenLyrics("pas du xml", "x")).toBeNull();
  });
});
