import { Context, Effect, Layer } from "effect";

import {
  type InvalidReference,
  Passage,
  PassageNotFound,
  type Translation,
  type ScriptureMatch,
  UnknownTranslation,
  formatReference,
  parseReference,
} from "../domain/Scripture";
import { ScriptureRepository } from "./ScriptureRepository";

/** Assez de résultats pour choisir, assez peu pour rester lisible. */
export const DEFAULT_SEARCH_LIMIT = 50;

export class Bible extends Context.Service<
  Bible,
  {
    readonly translations: Effect.Effect<ReadonlyArray<Translation>>;
    lookup(
      translationId: string,
      reference: string,
    ): Effect.Effect<Passage, InvalidReference | PassageNotFound | UnknownTranslation>;
    /** Recherche par contenu dans une traduction ; deux caractères au moins. */
    search(
      translationId: string,
      query: string,
      limit?: number,
    ): Effect.Effect<ReadonlyArray<ScriptureMatch>, UnknownTranslation>;
  }
>()("@projection/bible/Bible") {
  static readonly layer = Layer.effect(
    Bible,
    Effect.gen(function* () {
      const repository = yield* ScriptureRepository;

      const lookup = Effect.fn("Bible.lookup")(function* (translationId: string, input: string) {
        const reference = yield* parseReference(input);
        const translations = yield* repository.translations;
        const translation = translations.find((candidate) => candidate.id === translationId);
        if (translation === undefined) {
          return yield* new UnknownTranslation({ translationId });
        }

        const label = formatReference(reference);
        const verses = yield* repository.verses(translationId, reference);
        if (verses.length === 0) {
          return yield* new PassageNotFound({ label });
        }
        return new Passage({ translation, reference, label, verses });
      });

      const search = Effect.fn("Bible.search")(function* (
        translationId: string,
        query: string,
        limit = DEFAULT_SEARCH_LIMIT,
      ) {
        const translations = yield* repository.translations;
        if (!translations.some((candidate) => candidate.id === translationId)) {
          return yield* new UnknownTranslation({ translationId });
        }
        const trimmed = query.trim();
        if (trimmed.length < 2) return [];
        return yield* repository.search(translationId, trimmed, limit);
      });

      return Bible.of({ translations: repository.translations, lookup, search });
    }),
  );
}
