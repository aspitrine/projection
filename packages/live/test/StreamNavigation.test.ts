import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { LiveCursor, StreamCursor, StreamOverride } from "../src/domain/LiveSession";
import {
  followRoom,
  goToStreamCursor,
  nextStreamCursor,
  normalizeStreamCursor,
  previousStreamCursor,
  reconcileStream,
  streamContentAt,
  streamFrameContent,
  streamPositions,
} from "../src/domain/Navigation";
import { deckOf, item, itemId } from "./support";

const deck = deckOf([item(1, ["A1", "A2"], 2), item(2, []), item(3, ["C1"])]);
const at = (index: number, slideIndex: number, part: number) =>
  new StreamCursor({ itemId: itemId(index), slideIndex, part });
const text = (cursor: StreamCursor | null) => {
  const content = streamContentAt(deck, cursor);
  return content._tag === "Lines" ? content.lines.join(" ") : content._tag;
};

describe("Navigation du stream", () => {
  it("en mode lié, défile les parties de la diapo de la salle sans en sortir", () => {
    const start = followRoom(new LiveCursor({ itemId: itemId(1), slideIndex: 0 }));
    expect(text(start)).toBe("A1.1");
    expect(text(nextStreamCursor(deck, start, true))).toBe("A1.2");
    expect(text(nextStreamCursor(deck, at(1, 0, 1), true))).toBe("A1.2");
    expect(text(previousStreamCursor(deck, at(1, 0, 0), true))).toBe("A1.1");
    expect(nextStreamCursor(deck, null, true)).toBeNull();
  });

  it("en mode délié, parcourt toutes les parties du projet", () => {
    expect(streamPositions(deck).map(text)).toEqual(["A1.1", "A1.2", "A2.1", "A2.2", "C1"]);
    expect(text(nextStreamCursor(deck, at(1, 0, 1), false))).toBe("A2.1");
    expect(text(nextStreamCursor(deck, at(1, 1, 1), false))).toBe("C1");
    expect(text(nextStreamCursor(deck, at(3, 0, 0), false))).toBe("C1");
    expect(text(previousStreamCursor(deck, at(1, 1, 0), false))).toBe("A1.2");
    expect(text(nextStreamCursor(deck, null, false))).toBe("A1.1");
  });

  it.effect("valide un saut direct vers une partie", () =>
    Effect.gen(function* () {
      expect(text(yield* goToStreamCursor(deck, itemId(1), 1, 1))).toBe("A2.2");
      const error = yield* goToStreamCursor(deck, itemId(1), 0, 2).pipe(Effect.flip);
      expect(error._tag).toBe("LiveItemNotFound");
    }),
  );

  it("recale le stream après modification du projet ou mouvement de la salle", () => {
    expect(normalizeStreamCursor(deckOf([item(1, ["A1"])]), at(1, 0, 1))).toEqual(at(1, 0, 0));
    expect(normalizeStreamCursor(deck, at(2, 0, 0))).toBeNull();

    const room = new LiveCursor({ itemId: itemId(1), slideIndex: 0 });
    // Même diapo en salle : la partie en cours est gardée.
    expect(reconcileStream(deck, room, at(1, 0, 1), true)).toEqual(at(1, 0, 1));
    // La salle a changé de diapo : première partie de la nouvelle.
    expect(reconcileStream(deck, room, at(1, 1, 1), true)).toEqual(at(1, 0, 0));
    // Délié : indépendant de la salle.
    expect(reconcileStream(deck, room, at(1, 1, 1), false)).toEqual(at(1, 1, 1));
  });

  const Sizes = Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 3 })));

  it.prop(
    "délié : suivante puis précédente revient au même endroit (hors dernière partie)",
    { sizes: Sizes, parts: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 3 })) },
    ({ sizes, parts }) => {
      const generated = deckOf(
        sizes.map((size, index) =>
          item(
            index,
            Array.from({ length: size }, (_, slide) => `${index}.${slide}`),
            parts,
          ),
        ),
      );
      const list = streamPositions(generated);
      expect(list).toHaveLength(sizes.reduce((total, size) => total + size, 0) * parts);
      list.slice(0, -1).forEach((cursor) => {
        expect(
          previousStreamCursor(generated, nextStreamCursor(generated, cursor, false), false),
        ).toEqual(cursor);
      });
    },
  );
});

describe("Sélection manuelle du stream", () => {
  it("remplace la partie en cours tant qu'elle est présente", () => {
    const cursor = at(1, 0, 1);
    expect(streamFrameContent(deck, cursor, null)).toEqual(streamContentAt(deck, cursor));
    expect(streamFrameContent(deck, cursor, { lines: ["Ligne"], caption: "Refrain" })).toEqual({
      _tag: "Lines",
      lines: ["Ligne"],
      caption: "Refrain",
    });
  });

  it("accepte de 1 à 12 lignes", () => {
    const decode = Schema.decodeUnknownOption(StreamOverride);
    expect(decode({ lines: ["a"], caption: null })._tag).toBe("Some");
    expect(decode({ lines: [], caption: null })._tag).toBe("None");
    expect(decode({ lines: Array.from({ length: 13 }, () => "a"), caption: null })._tag).toBe(
      "None",
    );
  });
});
