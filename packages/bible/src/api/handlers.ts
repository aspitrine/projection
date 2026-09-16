import { Effect } from "effect";

import { Bible } from "../application/Bible";
import { BibleRpcs } from "./contract";

export const BibleHandlersLive = BibleRpcs.toLayer(
  Effect.gen(function* () {
    const bible = yield* Bible;

    return {
      BibleTranslations: () => bible.translations,
      BibleLookup: ({ translationId, reference }) => bible.lookup(translationId, reference),
      BibleSearch: ({ translationId, query }) => bible.search(translationId, query),
      BibleImport: ({ input, content }) => bible.importFile(input, content),
      BibleDefaultTranslation: () => bible.defaultTranslationId,
      BibleSetDefaultTranslation: ({ translationId }) => bible.setDefaultTranslation(translationId),
    };
  }),
);
