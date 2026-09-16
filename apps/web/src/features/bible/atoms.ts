import { Atom } from "effect/unstable/reactivity";

import { ApiClient } from "@/api/client";

export const translationsAtom = ApiClient.query("BibleTranslations", undefined);

/** Clé : `<translationId>\n<référence>`. */
export const passageAtom = Atom.family((key: string) => {
  const [translationId = "", reference = ""] = key.split("\n");
  return ApiClient.query("BibleLookup", { translationId, reference });
});

export const passageKey = (translationId: string, reference: string) =>
  `${translationId}\n${reference.trim()}`;

/** Clé : `<translationId>\n<recherche>`. */
export const scriptureSearchAtom = Atom.family((key: string) => {
  const [translationId = "", query = ""] = key.split("\n");
  return ApiClient.query("BibleSearch", { translationId, query });
});

export const searchKey = (translationId: string, query: string) =>
  `${translationId}\n${query.trim()}`;
