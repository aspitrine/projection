import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  ContentBlock,
  SplitRules,
  scriptureSplitRules,
  songSplitRules,
  split,
} from "../src/domain/Split";

const block = (key: string, lines: ReadonlyArray<string>, label: string | null = key) =>
  new ContentBlock({ key, label, lines });

const lines = (count: number, prefix = "ligne") =>
  Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);

describe("split — chants", () => {
  it("garde une section courte sur une seule diapo", () => {
    const slides = split([block("verse-1", lines(4))], songSplitRules(4));
    expect(slides).toHaveLength(1);
    expect(slides[0]?.lines).toEqual(lines(4));
    expect(slides[0]?.part).toBe(1);
    expect(slides[0]?.parts).toBe(1);
  });

  it("équilibre une section trop longue (5 lignes, max 4 → 3 + 2)", () => {
    const slides = split([block("verse-1", lines(5))], songSplitRules(4));
    expect(slides.map((slide) => slide.lines.length)).toEqual([3, 2]);
    expect(slides.map((slide) => [slide.part, slide.parts])).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("sans équilibrage, remplit chaque diapo au maximum (4 + 1)", () => {
    const rules = new SplitRules({ ...songSplitRules(4), balance: false });
    const slides = split([block("verse-1", lines(5))], rules);
    expect(slides.map((slide) => slide.lines.length)).toEqual([4, 1]);
  });

  it("ne mélange jamais deux sections sur une diapo", () => {
    const slides = split(
      [block("verse-1", lines(1, "c")), block("chorus", lines(1, "r"))],
      songSplitRules(4),
    );
    expect(slides.map((slide) => slide.blockKeys)).toEqual([["verse-1"], ["chorus"]]);
  });

  it("répète une section rejouée dans l'ordre de passage", () => {
    const chorus = block("chorus", lines(2, "r"), "Refrain");
    const slides = split(
      [block("verse-1", lines(2)), chorus, block("verse-2", lines(2)), chorus],
      songSplitRules(4),
    );
    expect(slides.map((slide) => slide.label)).toEqual([
      "verse-1",
      "Refrain",
      "verse-2",
      "Refrain",
    ]);
    expect(slides.map((slide) => slide.index)).toEqual([0, 1, 2, 3]);
  });

  it("ignore les blocs vides", () => {
    expect(split([block("intro", [])], songSplitRules(4))).toEqual([]);
  });
});

describe("split — versets", () => {
  it("place chaque verset sur sa propre diapo, même court", () => {
    const slides = split(
      [
        block("v16", ["a".repeat(40)]),
        block("v17", ["b".repeat(40)]),
        block("v18", ["c".repeat(40)]),
      ],
      scriptureSplitRules(100),
    );
    expect(slides.map((slide) => slide.blockKeys)).toEqual([["v16"], ["v17"], ["v18"]]);
    expect(slides.map((slide) => slide.label)).toEqual(["v16", "v17", "v18"]);
  });

  it("laisse seul un verset plus long que la limite", () => {
    const slides = split(
      [block("v1", ["x".repeat(300)]), block("v2", ["y"])],
      scriptureSplitRules(100),
    );
    expect(slides.map((slide) => slide.blockKeys)).toEqual([["v1"], ["v2"]]);
  });
});

const Line = Schema.Literals(["Gloire", "à Dieu", "Alléluia", "Il est bon", "Saint, saint", ""]);
const Blocks = Schema.Array(Schema.Array(Line));
const MaxLines = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 8 }));

describe("split — invariants", () => {
  it.prop(
    "conserve toutes les lignes, dans l'ordre",
    { blocks: Blocks, maxLines: MaxLines, balance: Schema.Boolean },
    ({ blocks, maxLines, balance }) => {
      const input = blocks.map((blockLines, index) => block(`b${index}`, blockLines));
      const rules = new SplitRules({ ...songSplitRules(maxLines), balance });
      const slides = split(input, rules);
      expect(slides.flatMap((slide) => slide.lines)).toEqual(blocks.flat());
    },
  );

  it.prop(
    "ne dépasse jamais maxLines",
    { blocks: Blocks, maxLines: MaxLines, balance: Schema.Boolean },
    ({ blocks, maxLines, balance }) => {
      const input = blocks.map((blockLines, index) => block(`b${index}`, blockLines));
      const slides = split(input, new SplitRules({ ...songSplitRules(maxLines), balance }));
      for (const slide of slides) {
        expect(slide.lines.length).toBeGreaterThan(0);
        expect(slide.lines.length).toBeLessThanOrEqual(maxLines);
      }
    },
  );

  it.prop(
    "l'équilibrage ne crée pas plus de diapos que la découpe gloutonne",
    { blocks: Blocks, maxLines: MaxLines },
    ({ blocks, maxLines }) => {
      const input = blocks.map((blockLines, index) => block(`b${index}`, blockLines));
      const balanced = split(input, songSplitRules(maxLines));
      const greedy = split(input, new SplitRules({ ...songSplitRules(maxLines), balance: false }));
      expect(balanced.length).toBe(greedy.length);
    },
  );
});
