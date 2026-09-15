import { describe, expect, it } from "@effect/vitest";

import { togglePrefix, toggleWrap } from "../src/features/slides/markup";

describe("toggleWrap", () => {
  it("met la sélection en gras et la garde sélectionnée", () => {
    const edit = toggleWrap("Culte à 10 h", 8, 12, "**", "texte");
    expect(edit.value).toBe("Culte à **10 h**");
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe("10 h");
  });

  it("retire le marqueur s'il entoure déjà la sélection", () => {
    const edit = toggleWrap("Culte à **10 h**", 10, 14, "**", "texte");
    expect(edit.value).toBe("Culte à 10 h");
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe("10 h");
  });

  it("insère un texte d'exemple sélectionné quand rien n'est sélectionné", () => {
    const edit = toggleWrap("Bonjour ", 8, 8, "*", "italique");
    expect(edit.value).toBe("Bonjour *italique*");
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe("italique");
  });
});

describe("togglePrefix", () => {
  it("transforme les lignes sélectionnées en liste", () => {
    const value = "Intro\nChorale\nPrière\nFin";
    const edit = togglePrefix(value, 8, 16, "- ");
    expect(edit.value).toBe("Intro\n- Chorale\n- Prière\nFin");
  });

  it("retire le préfixe si toutes les lignes l'ont déjà", () => {
    const edit = togglePrefix("- a\n- b", 0, 7, "- ");
    expect(edit.value).toBe("a\nb");
  });

  it("remplace un autre préfixe de ligne (liste → titre)", () => {
    const edit = togglePrefix("- Annonces", 3, 3, "# ");
    expect(edit.value).toBe("# Annonces");
  });
});
