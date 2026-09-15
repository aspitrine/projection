import { describe, expect, it } from "@effect/vitest";

import { docToLyrics, lyricsToDoc, nextSectionLabel } from "../src/features/songs/lyrics-doc";

describe("Conversion paroles ↔ éditeur", () => {
  it("fait l'aller-retour sans perte (balises, lignes vides, rejeu)", () => {
    const lyrics =
      "[Couplet 1]\nIl est bon\nde louer\n\n[Refrain]\nAlléluia\n[Refrain]\n\nStrophe libre";
    expect(docToLyrics(lyricsToDoc(lyrics))).toBe(lyrics);
  });

  it("transforme les balises en étiquettes et les lignes en paragraphes", () => {
    expect(lyricsToDoc(" [ Refrain ] \nAlléluia\n\n")).toEqual({
      type: "doc",
      content: [
        { type: "sectionTag", content: [{ type: "text", text: "Refrain" }] },
        { type: "paragraph", content: [{ type: "text", text: "Alléluia" }] },
      ],
    });
    expect(lyricsToDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("ignore les étiquettes vides", () => {
    expect(
      docToLyrics({
        type: "doc",
        content: [
          { type: "sectionTag" },
          { type: "paragraph", content: [{ type: "text", text: "a" }] },
        ],
      }),
    ).toBe("\na");
  });

  it("numérote le couplet suivant", () => {
    expect(nextSectionLabel("", "verse")).toBe("Couplet 1");
    expect(nextSectionLabel("[Couplet 1]\na\n[Verse 3]\nb\n[Refrain]", "verse")).toBe("Couplet 4");
    expect(nextSectionLabel("[Couplet 1]", "chorus")).toBe("Refrain");
  });
});
