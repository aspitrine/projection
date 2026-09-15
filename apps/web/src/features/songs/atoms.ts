import type { SongId } from "@projection/shared-kernel";
import { Atom } from "effect/unstable/reactivity";

import { ApiClient } from "@/api/client";

/** Clé de réactivité : toute mutation qui la déclare rafraîchit les requêtes de chants. */
export const songsReactivity = ["songs"] as const;

export const songsListAtom = Atom.family((search: string) =>
  ApiClient.query(
    "SongsList",
    { search: search.trim() === "" ? null : search.trim() },
    { reactivityKeys: songsReactivity },
  ),
);

export const songAtom = Atom.family((id: SongId) =>
  ApiClient.query("SongsGet", { id }, { reactivityKeys: songsReactivity }),
);

export const createSongAtom = ApiClient.mutation("SongsCreate");
export const updateSongAtom = ApiClient.mutation("SongsUpdate");
export const deleteSongAtom = ApiClient.mutation("SongsDelete");
