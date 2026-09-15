import { Context, Effect, Layer } from "effect";

import {
  type InvalidReference,
  Passage,
  PassageNotFound,
  type Translation,
  UnknownTranslation,
  formatReference,
  parseReference,
} from "../domain/Scripture";
import { ScriptureRepository } from "./ScriptureRepository";

export class Bible extends Context.Service<
  Bible,
  {
    readonly translations: Effect.Effect<ReadonlyArray<Translation>>;
    lookup(
      translationId: string,
      reference: string,
    ): Effect.Effect<Passage, InvalidReference | PassageNotFound | UnknownTranslation>;
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

      return Bible.of({ translations: repository.translations, lookup });
    }),
  );
}
