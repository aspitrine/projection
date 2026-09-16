import { Effect, Schema } from "effect";

import { BookCode, bookByCode, findBook } from "./Books";

export class ScripturePoint extends Schema.Class<ScripturePoint>("ScripturePoint")({
  chapter: Schema.Int,
  /** `null` : chapitre entier. */
  verse: Schema.NullOr(Schema.Int),
}) {}

export class ScriptureReference extends Schema.Class<ScriptureReference>("ScriptureReference")({
  book: BookCode,
  start: ScripturePoint,
  end: ScripturePoint,
}) {}

export class Verse extends Schema.Class<Verse>("Verse")({
  book: BookCode,
  chapter: Schema.Int,
  verse: Schema.Int,
  text: Schema.String,
}) {}

export class Translation extends Schema.Class<Translation>("Translation")({
  id: Schema.NonEmptyString,
  code: Schema.String,
  name: Schema.String,
  language: Schema.String,
  license: Schema.String,
}) {}

export class Passage extends Schema.Class<Passage>("Passage")({
  translation: Translation,
  reference: ScriptureReference,
  /** Référence formatée : « Jean 3.16-18 ». */
  label: Schema.String,
  verses: Schema.Array(Verse),
}) {}

/** Verset trouvé par une recherche par contenu. */
export class ScriptureMatch extends Schema.Class<ScriptureMatch>("ScriptureMatch")({
  translationId: Schema.String,
  /** Référence formatée : « Jean 3.16 ». */
  label: Schema.String,
  verse: Verse,
  /** Texte du verset avec les mots trouvés encadrés. */
  excerpt: Schema.String,
}) {}

export class InvalidReference extends Schema.TaggedError<InvalidReference>()("InvalidReference", {
  reason: Schema.Literals(["Empty", "UnknownBook", "Malformed", "InvalidRange"]),
  input: Schema.String,
}) {}

export class PassageNotFound extends Schema.TaggedError<PassageNotFound>()("PassageNotFound", {
  label: Schema.String,
}) {}

export class UnknownTranslation extends Schema.TaggedError<UnknownTranslation>()(
  "UnknownTranslation",
  { translationId: Schema.String },
) {}

const referencePattern =
  /^(.+?)\s*(\d+)(?:\s*[:.,]\s*(\d+))?(?:\s*[-–—]\s*(\d+)(?:\s*[:.,]\s*(\d+))?)?$/;

const toInt = (value: string | undefined) => (value === undefined ? null : Number(value));

/**
 * Lit une référence en français : « Jean 3.16-18 », « jn 3:16 », « 1 Co 13 »,
 * « Ps 23.1-4 », « Jean 3.16-4.2 », « Jean 3-4 », « Jude 3 ».
 */
export const parseReference = Effect.fnUntraced(function* (rawInput: string) {
  const input = rawInput.trim();
  if (input === "") {
    return yield* new InvalidReference({ reason: "Empty", input });
  }

  const match = referencePattern.exec(input);
  if (match === null) {
    return yield* new InvalidReference({
      reason: findBook(input) === undefined ? "UnknownBook" : "Malformed",
      input,
    });
  }

  const book = findBook(match[1] ?? "");
  if (book === undefined) {
    return yield* new InvalidReference({ reason: "UnknownBook", input });
  }

  const first = Number(match[2]);
  const second = toInt(match[3]);
  const third = toInt(match[4]);
  const fourth = toInt(match[5]);

  let start: ScripturePoint;
  let end: ScripturePoint;

  if (book.singleChapter && second === null) {
    // « Jude 3 » ou « Jude 3-5 » : numéros de versets du chapitre unique.
    start = new ScripturePoint({ chapter: 1, verse: first });
    end = new ScripturePoint({ chapter: 1, verse: third ?? first });
  } else if (second === null) {
    // « Jean 3 » ou « Jean 3-4 » : chapitres entiers.
    if (fourth !== null) {
      return yield* new InvalidReference({ reason: "Malformed", input });
    }
    start = new ScripturePoint({ chapter: first, verse: null });
    end = new ScripturePoint({ chapter: third ?? first, verse: null });
  } else if (fourth !== null) {
    // « Jean 3.16-4.2 »
    start = new ScripturePoint({ chapter: first, verse: second });
    end = new ScripturePoint({ chapter: third ?? first, verse: fourth });
  } else {
    // « Jean 3.16 » ou « Jean 3.16-18 »
    start = new ScripturePoint({ chapter: first, verse: second });
    end = new ScripturePoint({ chapter: first, verse: third ?? second });
  }

  const valid =
    start.chapter >= 1 &&
    (start.verse === null || start.verse >= 1) &&
    (end.chapter > start.chapter ||
      (end.chapter === start.chapter && (end.verse ?? Infinity) >= (start.verse ?? 0)));
  if (!valid) {
    return yield* new InvalidReference({ reason: "InvalidRange", input });
  }

  return new ScriptureReference({ book: book.code, start, end });
});

const point = ({ chapter, verse }: ScripturePoint) =>
  verse === null ? `${chapter}` : `${chapter}.${verse}`;

/** Format canonique français : « Jean 3.16-18 », « Jean 3.16-4.2 », « Psaumes 23 ». */
export const formatReference = (reference: ScriptureReference) => {
  const { name, singleChapter } = bookByCode(reference.book);
  const { start, end } = reference;
  const startText = singleChapter && start.verse !== null ? `${start.verse}` : point(start);

  if (start.chapter === end.chapter && start.verse === end.verse) {
    return `${name} ${startText}`;
  }
  if (start.chapter === end.chapter && start.verse !== null && end.verse !== null) {
    return `${name} ${startText}-${end.verse}`;
  }
  return `${name} ${startText}-${point(end)}`;
};

export const verseLabel = (verse: Verse) =>
  formatReference(
    new ScriptureReference({
      book: verse.book,
      start: new ScripturePoint({ chapter: verse.chapter, verse: verse.verse }),
      end: new ScripturePoint({ chapter: verse.chapter, verse: verse.verse }),
    }),
  );
