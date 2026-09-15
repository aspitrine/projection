import { describe, expect, it } from "@effect/vitest";

import { parseUsfm } from "../src/domain/Usfm";
import { johnUsfm, psalmsUsfm } from "./fixtures";

describe("parseUsfm", () => {
  it("lit le code du livre et les versets, sans introduction ni titres", () => {
    const book = parseUsfm(johnUsfm);
    expect(book.code).toBe("JHN");
    expect(book.verses.map(({ chapter, verse }) => [chapter, verse])).toEqual([
      [3, 16],
      [3, 17],
      [3, 18],
      [4, 1],
    ]);
  });

  it("retire les marqueurs de mots, attributs Strong et références croisées", () => {
    const [verse] = parseUsfm(johnUsfm).verses;
    expect(verse?.text).toBe(
      "Car Dieu a tant aimé le monde qu’il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu’il ait la vie éternelle.",
    );
  });

  it("n'inclut pas les titres de section dans le verset précédent", () => {
    const verse17 = parseUsfm(johnUsfm).verses[1];
    expect(verse17?.text).not.toContain("titre");
  });

  it("rattache les lignes de poésie au verset en cours et gère un \\v en milieu de ligne", () => {
    const book = parseUsfm(psalmsUsfm);
    expect(book.verses).toEqual([
      {
        chapter: 23,
        verse: 1,
        text: "Cantique de David. L’Éternel est mon berger: je ne manquerai de rien.",
      },
      {
        chapter: 23,
        verse: 2,
        text: "Il me fait reposer dans de verts pâturages, Il me dirige près des eaux paisibles.",
      },
      { chapter: 23, verse: 3, text: "Il restaure mon âme," },
    ]);
  });

  it("gère les fins de ligne Windows", () => {
    expect(parseUsfm(psalmsUsfm.replace(/\n/g, "\r\n")).verses).toHaveLength(3);
  });
});
