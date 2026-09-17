import type { MediaId } from "@projection/shared-kernel";
import { Atom } from "effect/unstable/reactivity";

import { ApiClient } from "@/api/client";

export const mediaReactivity = ["media"] as const;

export const mediaListAtom = ApiClient.query("MediaList", undefined, {
  reactivityKeys: mediaReactivity,
});

/** URL de lecture signée, renouvelée quand la bibliothèque change. */
export const mediaUrlAtom = Atom.family((id: MediaId) =>
  ApiClient.query("MediaUrl", { id }, { reactivityKeys: mediaReactivity }),
);

export const requestUploadAtom = ApiClient.mutation("MediaRequestUpload");
export const confirmUploadAtom = ApiClient.mutation("MediaConfirmUpload");
export const renameMediaAtom = ApiClient.mutation("MediaRename");
export const deleteMediaAtom = ApiClient.mutation("MediaDelete");
