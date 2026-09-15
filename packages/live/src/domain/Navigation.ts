import type { FrameContent } from "@projection/presentation/domain";
import type { ProjectItemId } from "@projection/shared-kernel";
import { Effect } from "effect";

import type { Deck } from "./Deck";
import { LiveCursor, LiveItemNotFound } from "./LiveSession";

/** Toutes les positions diffusables, dans l'ordre (les éléments sans diapo sont sautés). */
export const positions = (deck: Deck): ReadonlyArray<LiveCursor> =>
  deck.items.flatMap((item) =>
    item.slides.map((_, slideIndex) => new LiveCursor({ itemId: item.itemId, slideIndex })),
  );

const indexOf = (list: ReadonlyArray<LiveCursor>, cursor: LiveCursor | null) =>
  cursor === null
    ? -1
    : list.findIndex(
        (position) =>
          position.itemId === cursor.itemId && position.slideIndex === cursor.slideIndex,
      );

export const firstCursor = (deck: Deck): LiveCursor | null => positions(deck)[0] ?? null;

/** Diapo suivante (passe à l'élément suivant) ; reste sur la dernière. */
export const nextCursor = (deck: Deck, cursor: LiveCursor | null): LiveCursor | null => {
  const list = positions(deck);
  const index = indexOf(list, cursor);
  return (index === -1 ? list[0] : list[Math.min(index + 1, list.length - 1)]) ?? null;
};

/** Diapo précédente ; reste sur la première. */
export const previousCursor = (deck: Deck, cursor: LiveCursor | null): LiveCursor | null => {
  const list = positions(deck);
  const index = indexOf(list, cursor);
  return (index === -1 ? list[0] : list[Math.max(index - 1, 0)]) ?? null;
};

export const goToCursor = Effect.fnUntraced(function* (
  deck: Deck,
  itemId: ProjectItemId,
  slideIndex: number,
) {
  const item = deck.items.find((candidate) => candidate.itemId === itemId);
  if (item === undefined || slideIndex < 0 || slideIndex >= item.slides.length) {
    return yield* new LiveItemNotFound({ itemId });
  }
  return new LiveCursor({ itemId, slideIndex });
});

/**
 * Recale le curseur après une modification du projet : même élément (index borné),
 * ou aucun si l'élément a disparu ou n'a plus de diapo.
 */
export const normalizeCursor = (deck: Deck, cursor: LiveCursor | null): LiveCursor | null => {
  if (cursor === null) return null;
  const item = deck.items.find((candidate) => candidate.itemId === cursor.itemId);
  if (item === undefined || item.slides.length === 0) return null;
  return new LiveCursor({
    itemId: item.itemId,
    slideIndex: Math.min(Math.max(cursor.slideIndex, 0), item.slides.length - 1),
  });
};

export const contentAt = (deck: Deck | null, cursor: LiveCursor | null): FrameContent => {
  if (deck === null || cursor === null) return { _tag: "Blank" };
  const item = deck.items.find((candidate) => candidate.itemId === cursor.itemId);
  return item?.slides[cursor.slideIndex]?.content ?? { _tag: "Blank" };
};
