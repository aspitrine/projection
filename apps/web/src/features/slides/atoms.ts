import type { TextSlideId } from "@projection/shared-kernel";
import { Atom } from "effect/unstable/reactivity";

import { ApiClient } from "@/api/client";

export const slidesReactivity = ["slides"] as const;

export const slidesListAtom = Atom.family((search: string) =>
  ApiClient.query(
    "SlidesList",
    { search: search.trim() === "" ? null : search.trim() },
    { reactivityKeys: slidesReactivity },
  ),
);

export const slideAtom = Atom.family((id: TextSlideId) =>
  ApiClient.query("SlidesGet", { id }, { reactivityKeys: slidesReactivity }),
);

export const createSlideAtom = ApiClient.mutation("SlidesCreate");
export const updateSlideAtom = ApiClient.mutation("SlidesUpdate");
export const deleteSlideAtom = ApiClient.mutation("SlidesDelete");
