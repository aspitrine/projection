import { excerptAround, matchesSearch } from "@projection/shared-kernel";
import { Context, Effect, Layer } from "effect";

import { verseLabel } from "../domain/Scripture";

import type { ParsedBook } from "../domain/Osis";
import type { ScriptureMatch, ScriptureReference, Translation, Verse } from "../domain/Scripture";

/** Port de lecture des textes bibliques. */
export class ScriptureRepository extends Context.Service<
  ScriptureRepository,
  {
    /** Traductions livrées avec l'application, plus celles importées par l'organisation. */
    translations(organizationId: string): Effect.Effect<ReadonlyArray<Translation>>;
    /** Remplace tous les versets de la traduction (import idempotent). */
    importBooks(
      translation: Translation,
      books: ReadonlyArray<ParsedBook>,
    ): Effect.Effect<{ readonly books: number; readonly verses: number }>;
    defaultTranslationId(organizationId: string): Effect.Effect<string | null>;
    setDefaultTranslation(
      organizationId: string,
      translationId: string | null,
    ): Effect.Effect<void>;
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
        translations: (organizationId) =>
          Effect.succeed(
            translations.filter(
              (translation) =>
                translation.organizationId === null ||
                translation.organizationId === organizationId,
            ),
          ),
        importBooks: (_translation, books) =>
          Effect.succeed({
            books: books.length,
            verses: books.reduce((total, book) => total + book.verses.length, 0),
          }),
        defaultTranslationId: () => Effect.succeed(null),
        setDefaultTranslation: () => Effect.void,
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
