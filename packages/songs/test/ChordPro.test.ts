import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { parseChordPro } from "../src/domain/ChordPro";
import { parseLyrics } from "../src/domain/Lyrics";

describe("parseChordPro", () => {
  it.effect("lit métadonnées et sections, retire les accords, rejoue le refrain", () =>
    Effect.gen(function* () {
      const song = yield* parseChordPro(
        [
          "﻿{title: Grâce infinie}",
          "{artist: John Newton}",
          "{composer: Anonyme}",
          "{copyright: Domaine public}",
          "{meta: ccli 12345}",
          "# commentaire de fichier",
          "",
          "{start_of_verse: Couplet 1}",
          "[G]Grâce in[C]finie, [G]doux son",
          "[G]  [D]",
          "Qui [Em]sauva un [D]pécheur",
          "{end_of_verse}",
          "",
          "{soc}",
          "[C]Alléluia",
          "{eoc}",
          "",
          "{sov}",
          "Deuxième couplet",
          "{eov}",
          "{chorus}",
        ].join("\r\n"),
        "fichier",
      );

      expect(song).toEqual({
        title: "Grâce infinie",
        authors: "John Newton, Anonyme",
        copyright: "Domaine public",
        ccli: "12345",
        lyrics:
          "[Couplet 1]\nGrâce infinie, doux son\nQui sauva un pécheur\n\n[Refrain]\nAlléluia\n\n[Couplet]\nDeuxième couplet\n\n[Refrain]",
      });

      const parsed = yield* parseLyrics(song.lyrics);
      expect(parsed.arrangement).toEqual(["verse-1", "chorus", "verse-2", "chorus"]);
    }),
  );

  it.effect(
    "sans sections : strophes séparées par des lignes vides, commentaires comme libellés",
    () =>
      Effect.gen(function* () {
        const song = yield* parseChordPro(
          [
            "{t:Chant simple}",
            "Première ligne",
            "Deuxième ligne",
            "",
            "{c: Refrain}",
            "Ref [A]ligne",
            "",
            "{start_of_tab}",
            "e|---0---|",
            "{end_of_tab}",
            "Dernière strophe",
          ].join("\n"),
          "fichier",
        );
        expect(song.lyrics).toBe(
          "[Couplet]\nPremière ligne\nDeuxième ligne\n\n[Refrain]\nRef ligne\n\n[Couplet]\nDernière strophe",
        );
        expect(song.authors).toBeNull();
        expect((yield* parseLyrics(song.lyrics)).arrangement).toEqual([
          "verse-1",
          "chorus",
          "verse-2",
        ]);
      }),
  );

  it.effect("utilise le nom du fichier sans titre ; refuse un fichier sans paroles", () =>
    Effect.gen(function* () {
      expect((yield* parseChordPro("Seule ligne", "Mon chant")).title).toBe("Mon chant");
      const error = yield* parseChordPro("{title: Vide}\n{chorus}\n[G] [C]", "x").pipe(Effect.flip);
      expect(error.reason).toBe("NoLyrics");
    }),
  );
});
