import { excerptAround, matchesSearch } from "@projection/shared-kernel";
import { Context, Effect, Layer } from "effect";

import { verseLabel } from "../domain/Scripture";

import type { ScriptureMatch, ScriptureReference, Translation, Verse } from "../domain/Scripture";

/** Port de lecture des textes bibliques. */
export class ScriptureRepository extends Context.Service<
  ScriptureRepository,
  {
    readonly translations: Effect.Effect<ReadonlyArray<Translation>>;
    verses(
      translationId: string,
      reference: ScriptureReference,
    ): Effect.Effect<ReadonlyArray<Verse>>;
    /** Recherche par contenu, sans casse ni accents. */
    search(
      translationId: string,
      query: string,
      limit: number,
    ): Effect.Effect<ReadonlyArray<ScriptureMatch>>;
  }
>()("@projection/bible/ScriptureRepository") {
  /** Implémentation en mémoire pour les tests d'application. */
  static readonly layerMemory = (
    translations: ReadonlyArray<Translation>,
    versesByTranslation: Readonly<Record<string, ReadonlyArray<Verse>>>,
  ) =>
    Layer.succeed(
      ScriptureRepository,
      ScriptureRepository.of({
        translations: Effect.succeed(translations),
        search: (translationId, query, limit) =>
          Effect.succeed(
            (versesByTranslation[translationId] ?? [])
              .filter((verse) => matchesSearch(verse.text, query))
              .slice(0, limit)
              .map((verse) => ({
                translationId,
                label: verseLabel(verse),
                verse,
                excerpt: excerptAround(verse.text, query, 200) ?? verse.text,
              })),
          ),
        verses: (translationId, { book, start, end }) =>
          Effect.succeed(
            (versesByTranslation[translationId] ?? [])
              .filter((verse) => verse.book === book)
              .filter((verse) => {
                const afterStart =
                  verse.chapter > start.chapter ||
                  (verse.chapter === start.chapter && verse.verse >= (start.verse ?? 0));
                const beforeEnd =
                  verse.chapter < end.chapter ||
                  (verse.chapter === end.chapter && verse.verse <= (end.verse ?? Infinity));
                return afterStart && beforeEnd;
              })
              .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse),
          ),
      }),
    );
}
