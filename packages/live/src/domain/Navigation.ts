import type { FrameContent } from "@projection/presentation/domain";
import type { ProjectItemId } from "@projection/shared-kernel";
import { Effect } from "effect";

import type { Deck } from "./Deck";
import { LiveCursor, LiveItemNotFound, StreamCursor, type StreamOverride } from "./LiveSession";

const blank: FrameContent = { _tag: "Blank" };

const findItem = (deck: Deck, itemId: ProjectItemId) =>
  deck.items.find((candidate) => candidate.itemId === itemId);

// ─── Piste Salle ────────────────────────────────────────────────────────────

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
  const item = findItem(deck, itemId);
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
  const item = findItem(deck, cursor.itemId);
  if (item === undefined || item.slides.length === 0) return null;
  return new LiveCursor({
    itemId: item.itemId,
    slideIndex: Math.min(Math.max(cursor.slideIndex, 0), item.slides.length - 1),
  });
};

export const contentAt = (deck: Deck | null, cursor: LiveCursor | null): FrameContent => {
  if (deck === null || cursor === null) return blank;
  return findItem(deck, cursor.itemId)?.slides[cursor.slideIndex]?.content ?? blank;
};

// ─── Piste Stream ───────────────────────────────────────────────────────────

const partsOf = (deck: Deck, itemId: ProjectItemId, slideIndex: number) =>
  findItem(deck, itemId)?.slides[slideIndex]?.parts ?? [];

const sameSlide = (
  a: { itemId: string; slideIndex: number },
  b: { itemId: string; slideIndex: number },
) => a.itemId === b.itemId && a.slideIndex === b.slideIndex;

/** Toutes les parties diffusables sur le stream, dans l'ordre. */
export const streamPositions = (deck: Deck): ReadonlyArray<StreamCursor> =>
  deck.items.flatMap((item) =>
    item.slides.flatMap((slide, slideIndex) =>
      slide.parts.map((_, part) => new StreamCursor({ itemId: item.itemId, slideIndex, part })),
    ),
  );

/** Première partie de la diapo de la salle. */
export const followRoom = (cursor: LiveCursor | null): StreamCursor | null =>
  cursor === null
    ? null
    : new StreamCursor({ itemId: cursor.itemId, slideIndex: cursor.slideIndex, part: 0 });

const withPart = (cursor: StreamCursor, part: number) =>
  new StreamCursor({ itemId: cursor.itemId, slideIndex: cursor.slideIndex, part });

const moveStream = (
  deck: Deck,
  cursor: StreamCursor | null,
  linked: boolean,
  step: 1 | -1,
): StreamCursor | null => {
  if (linked) {
    // Lié : on reste sur la diapo de la salle, seules ses parties défilent.
    if (cursor === null) return null;
    const last = Math.max(partsOf(deck, cursor.itemId, cursor.slideIndex).length - 1, 0);
    return withPart(cursor, Math.min(Math.max(cursor.part + step, 0), last));
  }
  const list = streamPositions(deck);
  const index =
    cursor === null
      ? -1
      : list.findIndex((position) => sameSlide(position, cursor) && position.part === cursor.part);
  if (index === -1) return list[0] ?? null;
  return list[Math.min(Math.max(index + step, 0), list.length - 1)] ?? null;
};

export const nextStreamCursor = (deck: Deck, cursor: StreamCursor | null, linked: boolean) =>
  moveStream(deck, cursor, linked, 1);

export const previousStreamCursor = (deck: Deck, cursor: StreamCursor | null, linked: boolean) =>
  moveStream(deck, cursor, linked, -1);

export const goToStreamCursor = Effect.fnUntraced(function* (
  deck: Deck,
  itemId: ProjectItemId,
  slideIndex: number,
  part: number,
) {
  const count = partsOf(deck, itemId, slideIndex).length;
  if (part < 0 || part >= count) {
    return yield* new LiveItemNotFound({ itemId });
  }
  return new StreamCursor({ itemId, slideIndex, part });
});

export const normalizeStreamCursor = (
  deck: Deck,
  cursor: StreamCursor | null,
): StreamCursor | null => {
  if (cursor === null) return null;
  const count = partsOf(deck, cursor.itemId, cursor.slideIndex).length;
  if (count === 0) return null;
  return withPart(cursor, Math.min(Math.max(cursor.part, 0), count - 1));
};

/**
 * Position du stream cohérente avec la salle : en mode lié, il reste sur la partie en
 * cours si la salle n'a pas changé de diapo, sinon il repart de la première partie.
 */
export const reconcileStream = (
  deck: Deck,
  room: LiveCursor | null,
  stream: StreamCursor | null,
  linked: boolean,
): StreamCursor | null => {
  const normalized = normalizeStreamCursor(deck, stream);
  if (!linked) return normalized;
  return normalized !== null && room !== null && sameSlide(normalized, room)
    ? normalized
    : followRoom(room);
};

export const streamContentAt = (deck: Deck | null, cursor: StreamCursor | null): FrameContent => {
  if (deck === null || cursor === null) return blank;
  return partsOf(deck, cursor.itemId, cursor.slideIndex)[cursor.part] ?? blank;
};

/** Image de la piste Stream : sélection manuelle si présente, sinon la partie en cours. */
export const streamFrameContent = (
  deck: Deck | null,
  cursor: StreamCursor | null,
  override: StreamOverride | null,
): FrameContent =>
  override !== null
    ? { _tag: "Lines", lines: override.lines, caption: override.caption }
    : streamContentAt(deck, cursor);
