import { describe, expect, it } from "@effect/vitest";
import { ProjectItemId } from "@projection/shared-kernel";
import { Effect, Schema } from "effect";

import { createItem, insertItem, moveItem, removeItem } from "../src/domain/Items";
import type { ProjectItem } from "../src/domain/Project";

const itemId = (index: number) =>
  ProjectItemId.make(`00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`);

const blanks = (count: number): ReadonlyArray<ProjectItem> =>
  Array.from({ length: count }, (_, index) => createItem({ _tag: "Blank" }, itemId(index)));

const ids = (items: ReadonlyArray<ProjectItem>) => items.map((item) => Number(item.id.slice(-12)));

describe("createItem", () => {
  it("crée l'élément correspondant au brouillon", () => {
    const item = createItem(
      { _tag: "Scripture", translationId: "lsg1910", reference: "Jean 3.16" },
      itemId(1),
    );
    expect(item).toMatchObject({ _tag: "Scripture", reference: "Jean 3.16", id: itemId(1) });
  });
});

describe("insertItem", () => {
  it("ajoute à la fin, au début ou à une position bornée", () => {
    const items = blanks(3);
    const extra = createItem({ _tag: "Blank" }, itemId(9));
    expect(ids(insertItem(items, extra, null))).toEqual([0, 1, 2, 9]);
    expect(ids(insertItem(items, extra, 0))).toEqual([9, 0, 1, 2]);
    expect(ids(insertItem(items, extra, 1))).toEqual([0, 9, 1, 2]);
    expect(ids(insertItem(items, extra, 99))).toEqual([0, 1, 2, 9]);
    expect(ids(insertItem(items, extra, -5))).toEqual([9, 0, 1, 2]);
  });
});

describe("moveItem / removeItem", () => {
  it.effect("déplace un élément vers le haut ou vers le bas", () =>
    Effect.gen(function* () {
      const items = blanks(4);
      expect(ids(yield* moveItem(items, itemId(3), 0))).toEqual([3, 0, 1, 2]);
      expect(ids(yield* moveItem(items, itemId(0), 3))).toEqual([1, 2, 3, 0]);
      expect(ids(yield* moveItem(items, itemId(1), 2))).toEqual([0, 2, 1, 3]);
    }),
  );

  it.effect("retire un élément", () =>
    Effect.gen(function* () {
      expect(ids(yield* removeItem(blanks(3), itemId(1)))).toEqual([0, 2]);
    }),
  );

  it.effect("signale un élément inconnu", () =>
    Effect.gen(function* () {
      expect((yield* moveItem(blanks(2), itemId(7), 0).pipe(Effect.flip))._tag).toBe(
        "ProjectItemNotFound",
      );
      expect((yield* removeItem(blanks(2), itemId(7)).pipe(Effect.flip))._tag).toBe(
        "ProjectItemNotFound",
      );
    }),
  );

  const Count = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 12 }));
  const Index = Schema.Int.check(Schema.isBetween({ minimum: -3, maximum: 15 }));

  it.prop(
    "un déplacement conserve tous les éléments, sans doublon",
    { count: Count, from: Index, to: Index },
    ({ count, from, to }) => {
      const items = blanks(count);
      const source = items[Math.min(Math.max(from, 0), count - 1)];
      if (source === undefined) return;
      const moved = Effect.runSync(moveItem(items, source.id, to));
      expect(moved).toHaveLength(count);
      expect([...ids(moved)].sort((a, b) => a - b)).toEqual(ids(items));
      expect(moved[Math.min(Math.max(to, 0), count - 1)]?.id).toBe(source.id);
    },
  );
});
