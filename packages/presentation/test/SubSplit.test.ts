import { describe, expect, it } from "@effect/vitest";

import type { FrameContent } from "../src/domain/Frame";
import { scriptureSplitRules, songSplitRules, subSplit } from "../src/domain/Split";

const lines = (
  values: ReadonlyArray<string>,
  caption: string | null = "Refrain",
): FrameContent => ({
  _tag: "Lines",
  lines: values,
  caption,
});

describe("subSplit", () => {
  it("sous-découpe une strophe en parties équilibrées en gardant le libellé", () => {
    expect(subSplit(lines(["a", "b", "c", "d", "e"]), songSplitRules(2))).toEqual([
      lines(["a", "b"]),
      lines(["c", "d"]),
      lines(["e"]),
    ]);
  });

  it("garde entiers le texte court, le texte enrichi et l'écran vide", () => {
    expect(subSplit(lines(["a", "b"]), songSplitRules(2))).toEqual([lines(["a", "b"])]);
    const rich: FrameContent = { _tag: "Rich", source: "# Titre", layout: "free", caption: null };
    expect(subSplit(rich, songSplitRules(1))).toEqual([rich]);
    expect(subSplit({ _tag: "Blank" }, songSplitRules(1))).toEqual([{ _tag: "Blank" }]);
    expect(subSplit(lines([]), songSplitRules(1))).toEqual([lines([])]);
  });

  it("découpe les versets par nombre de caractères", () => {
    const verses = lines(["x".repeat(60), "y".repeat(60), "z".repeat(60)], "Jean 3.16");
    expect(
      subSplit(verses, scriptureSplitRules(130)).map(
        (part) => part._tag === "Lines" && part.lines.length,
      ),
    ).toEqual([2, 1]);
  });
});
