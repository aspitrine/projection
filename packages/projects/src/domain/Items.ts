import type { ProjectItemId } from "@projection/shared-kernel";
import { Effect } from "effect";

import {
  BlankItem,
  type ProjectItem,
  type ProjectItemDraft,
  ProjectItemNotFound,
  ScriptureItem,
  SongItem,
  TextSlideItem,
} from "./Project";

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

export const createItem = (draft: ProjectItemDraft, id: ProjectItemId): ProjectItem => {
  switch (draft._tag) {
    case "Song":
      return new SongItem({ id, songId: draft.songId });
    case "Scripture":
      return new ScriptureItem({
        id,
        translationId: draft.translationId,
        reference: draft.reference,
      });
    case "TextSlide":
      return new TextSlideItem({ id, textSlideId: draft.textSlideId });
    case "Blank":
      return new BlankItem({ id });
  }
};

/** Insère à la position donnée (bornée), ou à la fin si `null`. */
export const insertItem = (
  items: ReadonlyArray<ProjectItem>,
  item: ProjectItem,
  position: number | null,
): ReadonlyArray<ProjectItem> => {
  const index = position === null ? items.length : clamp(position, items.length);
  return [...items.slice(0, index), item, ...items.slice(index)];
};

export const removeItem = Effect.fnUntraced(function* (
  items: ReadonlyArray<ProjectItem>,
  itemId: ProjectItemId,
) {
  if (!items.some((item) => item.id === itemId)) {
    return yield* new ProjectItemNotFound({ itemId });
  }
  return items.filter((item) => item.id !== itemId);
});

/** Déplace un élément à l'index cible (dans la liste après retrait), borné. */
export const moveItem = Effect.fnUntraced(function* (
  items: ReadonlyArray<ProjectItem>,
  itemId: ProjectItemId,
  toIndex: number,
) {
  const from = items.findIndex((item) => item.id === itemId);
  const moved = items[from];
  if (moved === undefined) {
    return yield* new ProjectItemNotFound({ itemId });
  }
  const rest = items.filter((item) => item.id !== itemId);
  const index = clamp(toIndex, rest.length);
  return [...rest.slice(0, index), moved, ...rest.slice(index)];
});
