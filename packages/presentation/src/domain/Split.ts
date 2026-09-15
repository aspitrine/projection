import { Schema } from "effect";

import type { FrameContent } from "./Frame";

/**
 * Bloc de contenu à projeter : une section de chant (dans l'ordre de passage)
 * ou un verset biblique. Les lignes ne sont jamais coupées.
 */
export class ContentBlock extends Schema.Class<ContentBlock>("ContentBlock")({
  /** Identifiant stable du bloc dans le contenu (ex. id de section). */
  key: Schema.String,
  /** Libellé affichable (ex. « Refrain », « Jean 3.16 »), ou `null`. */
  label: Schema.NullOr(Schema.String),
  lines: Schema.Array(Schema.String),
}) {}

export class SplitRules extends Schema.Class<SplitRules>("SplitRules")({
  /** Nombre maximal de lignes par diapo (≥ 1). */
  maxLines: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** Nombre maximal de caractères par diapo. Une ligne plus longue reste seule sur sa diapo. */
  maxCharacters: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
  /**
   * `false` (chants) : une diapo ne mélange jamais deux blocs.
   * `true` (versets) : les blocs courts sont regroupés sur une même diapo.
   */
  mergeBlocks: Schema.Boolean,
  /** Répartit les lignes équitablement (5 lignes, max 4 → 3 + 2) plutôt que 4 + 1. */
  balance: Schema.Boolean,
}) {}

export class Slide extends Schema.Class<Slide>("Slide")({
  index: Schema.Int,
  /** Clés des blocs présents sur la diapo, dans l'ordre. */
  blockKeys: Schema.Array(Schema.String),
  /** Libellé du premier bloc présent. */
  label: Schema.NullOr(Schema.String),
  lines: Schema.Array(Schema.String),
  /** Position dans le bloc quand un bloc est réparti sur plusieurs diapos (1-based). */
  part: Schema.Int,
  parts: Schema.Int,
}) {}

export const songSplitRules = (maxLines: number) =>
  new SplitRules({ maxLines, maxCharacters: null, mergeBlocks: false, balance: true });

export const scriptureSplitRules = (maxCharacters: number) =>
  new SplitRules({
    maxLines: Number.MAX_SAFE_INTEGER,
    maxCharacters,
    mergeBlocks: true,
    balance: false,
  });

const lineCharacters = (lines: ReadonlyArray<string>) =>
  lines.reduce((total, line) => total + line.length, 0);

const fits = (lines: ReadonlyArray<string>, next: string, rules: SplitRules) =>
  lines.length + 1 <= rules.maxLines &&
  (rules.maxCharacters === null || lineCharacters(lines) + next.length <= rules.maxCharacters);

/** Découpe gloutonne en respectant `maxLines` et `maxCharacters`. */
const greedyChunks = (lines: ReadonlyArray<string>, rules: SplitRules) => {
  const chunks: Array<Array<string>> = [];
  let current: Array<string> = [];
  for (const line of lines) {
    if (current.length > 0 && !fits(current, line, rules)) {
      chunks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
};

/** Même nombre de diapos que la découpe gloutonne, mais tailles équilibrées. */
const balancedChunks = (lines: ReadonlyArray<string>, rules: SplitRules) => {
  const greedy = greedyChunks(lines, rules);
  if (rules.maxCharacters !== null || greedy.length <= 1) return greedy;
  const count = greedy.length;
  const base = Math.floor(lines.length / count);
  const remainder = lines.length % count;
  const chunks: Array<Array<string>> = [];
  let offset = 0;
  for (let index = 0; index < count; index++) {
    const size = base + (index < remainder ? 1 : 0);
    chunks.push(lines.slice(offset, offset + size));
    offset += size;
  }
  return chunks;
};

const chunkBlock = (block: ContentBlock, rules: SplitRules) =>
  rules.balance ? balancedChunks(block.lines, rules) : greedyChunks(block.lines, rules);

/**
 * Découpe une suite de blocs en diapos.
 * Invariants : l'ordre et le contenu des lignes sont conservés ; aucune diapo
 * ne dépasse les limites (sauf une ligne seule trop longue) ; les blocs vides
 * ne produisent aucune diapo.
 */
export const split = (
  blocks: ReadonlyArray<ContentBlock>,
  rules: SplitRules,
): ReadonlyArray<Slide> => {
  const drafts: Array<Omit<Slide, "index">> = [];

  if (rules.mergeBlocks) {
    let lines: Array<string> = [];
    let keys: Array<string> = [];
    let label: string | null = null;
    const flush = () => {
      if (lines.length === 0) return;
      drafts.push({ blockKeys: keys, label, lines, part: 1, parts: 1 });
      lines = [];
      keys = [];
      label = null;
    };
    for (const block of blocks) {
      for (const line of block.lines) {
        if (lines.length > 0 && !fits(lines, line, rules)) flush();
        if (lines.length === 0) label = block.label;
        if (keys.at(-1) !== block.key) keys.push(block.key);
        lines.push(line);
      }
    }
    flush();
  } else {
    for (const block of blocks) {
      const chunks = chunkBlock(block, rules);
      chunks.forEach((lines, index) =>
        drafts.push({
          blockKeys: [block.key],
          label: block.label,
          lines,
          part: index + 1,
          parts: chunks.length,
        }),
      );
    }
  }

  return drafts.map((draft, index) => new Slide({ ...draft, index }));
};

/** Réglages de découpage d'une piste, modifiables par l'organisation. */
export const Splitting = Schema.Struct({
  /** Lignes de chant par diapo. */
  songMaxLines: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 12 })),
  /** Caractères de texte biblique par diapo. */
  scriptureMaxCharacters: Schema.Int.check(Schema.isBetween({ minimum: 40, maximum: 1000 })),
});
export type Splitting = typeof Splitting.Type;

/** Salle : strophe entière, passage généreux. */
export const roomSplitting: Splitting = { songMaxLines: 4, scriptureMaxCharacters: 320 };
/** Stream : lower third court. */
export const streamSplitting: Splitting = { songMaxLines: 2, scriptureMaxCharacters: 140 };

/**
 * Sous-découpe une diapo pour la piste Stream (ex. strophe de 4 lignes → 2 × 2 lignes).
 * Le texte enrichi et l'écran vide restent entiers. Toujours au moins une partie.
 */
export const subSplit = (content: FrameContent, rules: SplitRules): ReadonlyArray<FrameContent> => {
  if (content._tag !== "Lines") return [content];
  const parts = split(
    [new ContentBlock({ key: "slide", label: content.caption, lines: content.lines })],
    rules,
  );
  return parts.length <= 1
    ? [content]
    : parts.map((part) => ({ _tag: "Lines", lines: part.lines, caption: content.caption }));
};
