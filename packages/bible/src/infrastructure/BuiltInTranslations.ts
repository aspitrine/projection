import { readFile } from "node:fs/promises";

import { Effect } from "effect";
import { strFromU8, unzipSync } from "fflate";

import { Translation } from "../domain/Scripture";

export const lsg1910 = new Translation({
  id: "lsg1910",
  code: "LSG",
  name: "Louis Segond 1910",
  language: "fr",
  license: "Domaine public",
  organizationId: null,
});

/** Charge les fichiers USFM livrés avec l'application, sans dépendre du réseau. */
export const loadLsg1910 = Effect.fn("loadLsg1910")(function* () {
  const archive = yield* Effect.promise(() =>
    readFile(new URL("../../assets/fraLSG_usfm.zip", import.meta.url)),
  );
  const files = unzipSync(archive);
  return Object.entries(files)
    .filter(([name]) => name.endsWith(".usfm"))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, content]) => strFromU8(content));
});
