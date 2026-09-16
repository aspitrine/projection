import { CurrentActor, type Forbidden, requireRole } from "@projection/shared-kernel";
import { Context, Effect, Layer } from "effect";

import { bookCodes } from "../domain/Books";
import { type ParsedBook, detectXmlFormat, parseOsis, parseZefania } from "../domain/Osis";
import { parseUsfm } from "../domain/Usfm";

import {
  type InvalidReference,
  Passage,
  PassageNotFound,
  InvalidTranslationFile,
  type ScriptureMatch,
  Translation,
  type TranslationImported,
  type TranslationInput,
  UnknownTranslation,
  formatReference,
  parseReference,
} from "../domain/Scripture";
import { ScriptureRepository } from "./ScriptureRepository";

/** Reconnaît le format du fichier et en extrait les livres. */
const parseTranslationFile = (content: string): ReadonlyArray<ParsedBook> | null => {
  const format = detectXmlFormat(content);
  if (format === "osis") return parseOsis(content);
  if (format === "zefania") return parseZefania(content);
  // USFM : un fichier par livre, éventuellement concaténés (`\id` en tête de chacun).
  if (!content.includes("\\id ")) return null;
  const books = content.split(/(?=\\id )/).flatMap((part): ReadonlyArray<ParsedBook> => {
    const book = parseUsfm(part);
    const code = bookCodes.find((candidate) => candidate === book.code);
    // Livres hors canon protestant : ignorés, comme à l'import USFM par script.
    return code === undefined || book.verses.length === 0 ? [] : [{ code, verses: book.verses }];
  });
  return books.length === 0 ? null : books;
};

/** Assez de résultats pour choisir, assez peu pour rester lisible. */
export const DEFAULT_SEARCH_LIMIT = 50;

export class Bible extends Context.Service<
  Bible,
  {
    /** Traductions visibles par l'organisation courante. */
    readonly translations: Effect.Effect<ReadonlyArray<Translation>, never, CurrentActor>;
    lookup(
      translationId: string,
      reference: string,
    ): Effect.Effect<
      Passage,
      InvalidReference | PassageNotFound | UnknownTranslation,
      CurrentActor
    >;
    /** Recherche par contenu dans une traduction ; deux caractères au moins. */
    search(
      translationId: string,
      query: string,
      limit?: number,
    ): Effect.Effect<ReadonlyArray<ScriptureMatch>, UnknownTranslation, CurrentActor>;
    /** Import d'un fichier USFM, OSIS ou Zefania dans l'organisation courante. */
    importFile(
      input: TranslationInput,
      content: string,
    ): Effect.Effect<TranslationImported, InvalidTranslationFile | Forbidden, CurrentActor>;
    /** Traduction proposée par défaut à l'organisation. */
    readonly defaultTranslationId: Effect.Effect<string | null, never, CurrentActor>;
    setDefaultTranslation(
      translationId: string | null,
    ): Effect.Effect<void, UnknownTranslation | Forbidden, CurrentActor>;
  }
>()("@projection/bible/Bible") {
  static readonly layer = Layer.effect(
    Bible,
    Effect.gen(function* () {
      const repository = yield* ScriptureRepository;

      const visibleTranslations = Effect.gen(function* () {
        const actor = yield* CurrentActor;
        return yield* repository.translations(actor.organizationId);
      });

      const lookup = Effect.fn("Bible.lookup")(function* (translationId: string, input: string) {
        const reference = yield* parseReference(input);
        const translations = yield* visibleTranslations;
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
        const translations = yield* visibleTranslations;
        if (!translations.some((candidate) => candidate.id === translationId)) {
          return yield* new UnknownTranslation({ translationId });
        }
        const trimmed = query.trim();
        if (trimmed.length < 2) return [];
        return yield* repository.search(translationId, trimmed, limit);
      });

      const importFile = Effect.fn("Bible.importFile")(function* (
        input: TranslationInput,
        content: string,
      ) {
        const actor = yield* requireRole("owner", "admin");
        const books = parseTranslationFile(content);
        if (books === null) {
          return yield* new InvalidTranslationFile({ reason: "UnknownFormat" });
        }
        if (books.every((book) => book.verses.length === 0)) {
          return yield* new InvalidTranslationFile({ reason: "NoVerses" });
        }

        // Identifiant stable par organisation et par code : réimporter met à jour.
        const translation = new Translation({
          id: `${actor.organizationId}:${input.code.toLowerCase()}`,
          code: input.code,
          name: input.name,
          language: input.language,
          license: input.license,
          organizationId: actor.organizationId,
        });
        const counts = yield* repository.importBooks(translation, books);
        return { translationId: translation.id, ...counts };
      });

      const defaultTranslationId = Effect.gen(function* () {
        const actor = yield* CurrentActor;
        const stored = yield* repository.defaultTranslationId(actor.organizationId);
        if (stored !== null) return stored;
        // À défaut, la première traduction visible.
        const translations = yield* repository.translations(actor.organizationId);
        return translations[0]?.id ?? null;
      });

      const setDefaultTranslation = Effect.fn("Bible.setDefaultTranslation")(function* (
        translationId: string | null,
      ) {
        const actor = yield* requireRole("owner", "admin");
        if (translationId !== null) {
          const translations = yield* repository.translations(actor.organizationId);
          if (!translations.some((candidate) => candidate.id === translationId)) {
            return yield* new UnknownTranslation({ translationId });
          }
        }
        yield* repository.setDefaultTranslation(actor.organizationId, translationId);
      });

      return Bible.of({
        translations: visibleTranslations,
        lookup,
        search,
        importFile,
        defaultTranslationId,
        setDefaultTranslation,
      });
    }),
  );
}
