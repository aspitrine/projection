import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { LiveCursor } from "../src/domain/LiveSession";
import {
  contentAt,
  firstCursor,
  goToCursor,
  nextCursor,
  normalizeCursor,
  positions,
  previousCursor,
} from "../src/domain/Navigation";
import { deckOf, item, itemId } from "./support";

const deck = deckOf([item(1, ["A1", "A2"]), item(2, []), item(3, ["C1"])]);
const at = (index: number, slideIndex: number) =>
  new LiveCursor({ itemId: itemId(index), slideIndex });
const text = (cursor: LiveCursor | null) => {
  const content = contentAt(deck, cursor);
  return content._tag === "Lines" ? content.lines.join(" ") : content._tag;
};

describe("Navigation", () => {
  it("parcourt les diapos en sautant les éléments vides", () => {
    expect(text(firstCursor(deck))).toBe("A1");
    expect(text(nextCursor(deck, at(1, 0)))).toBe("A2");
    expect(text(nextCursor(deck, at(1, 1)))).toBe("C1");
    expect(text(nextCursor(deck, at(3, 0)))).toBe("C1");
    expect(text(previousCursor(deck, at(3, 0)))).toBe("A2");
    expect(text(previousCursor(deck, at(1, 0)))).toBe("A1");
  });

  it("repart du début depuis un curseur absent ou inconnu", () => {
    expect(text(nextCursor(deck, null))).toBe("A1");
    expect(text(previousCursor(deck, at(9, 0)))).toBe("A1");
    expect(firstCursor(deckOf([item(1, [])]))).toBeNull();
    expect(contentAt(null, at(1, 0))).toEqual({ _tag: "Blank" });
  });

  it.effect("valide un saut direct", () =>
    Effect.gen(function* () {
      expect(text(yield* goToCursor(deck, itemId(3), 0))).toBe("C1");
      expect((yield* goToCursor(deck, itemId(2), 0).pipe(Effect.flip))._tag).toBe(
        "LiveItemNotFound",
      );
      expect((yield* goToCursor(deck, itemId(1), 5).pipe(Effect.flip))._tag).toBe(
        "LiveItemNotFound",
      );
    }),
  );

  it("recale le curseur après modification du projet", () => {
    const edited = deckOf([item(4, ["D1"]), item(1, ["A1"])]);
    expect(normalizeCursor(edited, at(1, 1))).toEqual(at(1, 0));
    expect(normalizeCursor(edited, at(3, 0))).toBeNull();
    expect(normalizeCursor(edited, null)).toBeNull();
  });

  const Sizes = Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 4 })));

  it.prop(
    "suivante puis précédente revient au même endroit (hors dernière diapo)",
    { sizes: Sizes },
    ({ sizes }) => {
      const generated = deckOf(
        sizes.map((size, index) =>
          item(
            index,
            Array.from({ length: size }, (_, slide) => `${index}.${slide}`),
          ),
        ),
      );
      const list = positions(generated);
      list.slice(0, -1).forEach((cursor) => {
        expect(previousCursor(generated, nextCursor(generated, cursor))).toEqual(cursor);
      });
      expect(list).toHaveLength(sizes.reduce((total, size) => total + size, 0));
    },
  );
});
