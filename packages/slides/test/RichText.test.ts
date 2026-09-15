import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { parseInline, parseRichText, plainLines } from "../src/domain/RichText";

const text = (value: string) => ({ text: value, bold: false, italic: false });
const bold = (value: string) => ({ text: value, bold: true, italic: false });
const italic = (value: string) => ({ text: value, bold: false, italic: true });

describe("parseInline", () => {
  it("reconnaît gras, italique et gras italique", () => {
    expect(parseInline("Un **grand** et *doux* ***merci***")).toEqual([
      text("Un "),
      bold("grand"),
      text(" et "),
      italic("doux"),
      text(" "),
      { text: "merci", bold: true, italic: true },
    ]);
  });

  it("accepte _italique_ mais pas au milieu d'un mot", () => {
    expect(parseInline("_Amen_ mot_clé_ici")).toEqual([italic("Amen"), text(" mot_clé_ici")]);
  });

  it("laisse les marqueurs non fermés et les puces en texte", () => {
    expect(parseInline("5 * 3 = 15 et **pas fermé")).toEqual([text("5 * 3 = 15 et **pas fermé")]);
  });

  it("renvoie une liste vide pour une chaîne vide", () => {
    expect(parseInline("")).toEqual([]);
  });
});

describe("parseRichText", () => {
  it("construit titres, paragraphes multi-lignes et listes", () => {
    const blocks = parseRichText(
      "# Annonces\n## Dimanche\nCulte à **10 h**\nsuivi d'un repas\n\n- Chorale *18 h*\n* Prière\n\nMerci !",
    );
    expect(blocks).toEqual([
      { _tag: "Heading", level: 1, content: [text("Annonces")] },
      { _tag: "Heading", level: 2, content: [text("Dimanche")] },
      { _tag: "Paragraph", lines: [[text("Culte à "), bold("10 h")], [text("suivi d'un repas")]] },
      { _tag: "List", items: [[text("Chorale "), italic("18 h")], [text("Prière")]] },
      { _tag: "Paragraph", lines: [[text("Merci !")]] },
    ]);
  });

  it("sépare une liste d'un paragraphe qui la suit sans ligne vide", () => {
    expect(parseRichText("- a\n- b\nc").map((block) => block._tag)).toEqual(["List", "Paragraph"]);
  });

  it("ignore les lignes vides superflues et les fins de ligne Windows", () => {
    expect(parseRichText("\r\n\r\nBonjour\r\n\r\n\r\n")).toEqual([
      { _tag: "Paragraph", lines: [[text("Bonjour")]] },
    ]);
  });

  it.prop(
    "ne perd aucun mot d'un texte sans marqueurs",
    { words: Schema.Array(Schema.Literals(["Gloire", "à", "Dieu", "paix", "amour", "Jésus"])) },
    ({ words }) => {
      const source = words.join(" ");
      expect(plainLines(parseRichText(source)).join(" ").split(" ").filter(Boolean)).toEqual(words);
    },
  );

  it.prop("ne lève jamais d'exception", { source: Schema.String }, ({ source }) => {
    expect(() => plainLines(parseRichText(source))).not.toThrow();
  });
});

describe("plainLines", () => {
  it("donne le texte brut avec des puces pour les listes", () => {
    expect(plainLines(parseRichText("# **Titre**\nLigne *1*\n- item"))).toEqual([
      "Titre",
      "Ligne 1",
      "• item",
    ]);
  });
});
