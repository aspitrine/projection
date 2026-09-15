import { describe, expect, it } from "@effect/vitest";

import { docToSource, sourceToDoc } from "../src/features/slides/rich-text-doc";

describe("Conversion source ↔ éditeur des diapos texte", () => {
  it("fait l'aller-retour sans perte", () => {
    const source = [
      "# Annonces",
      "",
      "## Dimanche",
      "",
      "Culte à **10 h**, suivi d'un *repas* et de ***louange***.",
      "Deuxième ligne du paragraphe",
      "",
      "- Répétition à 18 h",
      "- Prière mercredi",
    ].join("\n");
    expect(docToSource(sourceToDoc(source))).toBe(source);
  });

  it("produit le document attendu par l'éditeur", () => {
    expect(sourceToDoc("# Titre\nligne **forte**")).toEqual({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Titre" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "ligne " },
            { type: "text", text: "forte", marks: [{ type: "bold" }] },
          ],
        },
      ],
    });
    expect(sourceToDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("écrit les marques avec les espaces hors des marqueurs et fusionne les segments", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Culte " },
            { type: "text", text: "à 10 ", marks: [{ type: "bold" }] },
            { type: "text", text: "h", marks: [{ type: "bold" }] },
            { type: "hardBreak" },
            { type: "text", text: "suite", marks: [{ type: "italic" }, { type: "bold" }] },
          ],
        },
        { type: "paragraph" },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "point" }] }],
            },
          ],
        },
      ],
    };
    expect(docToSource(doc)).toBe("Culte **à 10 h**\n***suite***\n\n- point");
  });
});
