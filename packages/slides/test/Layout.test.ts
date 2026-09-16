import { describe, expect, it } from "@effect/vitest";

import { applyLayout } from "../src/domain/Layout";
import { type Block, parseRichText, plainLines } from "../src/domain/RichText";

const blocksOf = (source: string) => parseRichText(source);

/** Toutes les lignes visibles, titre et attribution compris. */
const visibleLines = (layout: Parameters<typeof applyLayout>[0], blocks: ReadonlyArray<Block>) => {
  const result = applyLayout(layout, blocks);
  const heading = result.heading === null ? [] : [result.heading.map((part) => part.text).join("")];
  const attribution =
    result.attribution === null ? [] : [result.attribution.map((part) => part.text).join("")];
  return [...heading, ...plainLines(result.body), ...attribution];
};

describe("applyLayout", () => {
  it("laisse le contenu intact en mise en page libre", () => {
    const blocks = blocksOf("# Annonces\nCulte à 10 h");
    expect(applyLayout("free", blocks)).toEqual({
      heading: null,
      body: blocks,
      attribution: null,
      quoted: false,
    });
  });

  it("promeut le premier titre en en-tête", () => {
    const result = applyLayout("title", blocksOf("# Bienvenue\nAu culte de ce dimanche"));
    expect(result.heading?.map((part) => part.text).join("")).toBe("Bienvenue");
    expect(plainLines(result.body)).toEqual(["Au culte de ce dimanche"]);
  });

  it("promeut aussi une première ligne seule, sans marqueur de titre", () => {
    const result = applyLayout("titleBody", blocksOf("Bienvenue\n\nAu culte"));
    expect(result.heading?.map((part) => part.text).join("")).toBe("Bienvenue");
    expect(plainLines(result.body)).toEqual(["Au culte"]);
  });

  it("ne promeut pas une liste ni un paragraphe de plusieurs lignes", () => {
    expect(applyLayout("title", blocksOf("- premier\n- second")).heading).toBeNull();
    expect(applyLayout("title", blocksOf("une ligne\nune autre")).heading).toBeNull();
  });

  it("détache l'attribution d'une citation et conserve ses marques", () => {
    const result = applyLayout("quote", blocksOf("Tout est grâce.\n\n— *Bernanos*"));
    expect(result.quoted).toBe(true);
    expect(plainLines(result.body)).toEqual(["Tout est grâce."]);
    expect(result.attribution).toEqual([{ text: "Bernanos", bold: false, italic: true }]);
  });

  it("garde la dernière ligne quand le paragraphe contient aussi du texte", () => {
    const result = applyLayout("quote", blocksOf("Tout est grâce.\n— Bernanos"));
    expect(plainLines(result.body)).toEqual(["Tout est grâce."]);
    expect(result.attribution?.map((part) => part.text).join("")).toBe("Bernanos");
  });

  it("ne prend pas une liste pour une attribution", () => {
    const result = applyLayout("quote", blocksOf("Citation\n\n- élément"));
    expect(result.attribution).toBeNull();
    expect(plainLines(result.body)).toEqual(["Citation", "• élément"]);
  });

  it("ne perd aucune ligne, quelle que soit la mise en page", () => {
    const blocks = blocksOf("# Titre\nCorps de la diapo\n\n— Auteur");
    const lines = plainLines(blocks);
    for (const layout of ["free", "title", "titleBody", "quote"] as const) {
      // Seule la citation détache l'attribution, sans son tiret.
      const expected = layout === "quote" ? lines.map((line) => line.replace(/^—\s*/u, "")) : lines;
      expect(visibleLines(layout, blocks)).toEqual(expected);
    }
  });
});
