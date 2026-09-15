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
