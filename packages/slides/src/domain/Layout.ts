import type { SlideLayout } from "@projection/presentation/domain";

import type { Block, Inline } from "./RichText";

/**
 * Contenu réparti selon la mise en page. Aucun bloc n'est perdu : ce qui n'est pas
 * promu en titre ou en attribution reste dans le corps.
 */
export interface LayoutedSlide {
  /** Titre mis en avant (mises en page `title` et `titleBody`). */
  readonly heading: ReadonlyArray<Inline> | null;
  readonly body: ReadonlyArray<Block>;
  /** Auteur d'une citation, repris de la dernière ligne préfixée d'un tiret. */
  readonly attribution: ReadonlyArray<Inline> | null;
  /** Le corps s'affiche entre guillemets (mise en page `quote`). */
  readonly quoted: boolean;
}

const inlinesOf = (block: Block): ReadonlyArray<Inline> | null => {
  switch (block._tag) {
    case "Heading":
      return block.content;
    case "Paragraph":
      return block.lines.length === 1 ? (block.lines[0] ?? null) : null;
    case "List":
      return null;
  }
};

/** Extrait le premier bloc comme titre, s'il peut en tenir lieu (titre ou ligne seule). */
const splitHeading = (
  blocks: ReadonlyArray<Block>,
): { heading: ReadonlyArray<Inline> | null; body: ReadonlyArray<Block> } => {
  const first = blocks[0];
  if (first === undefined) return { heading: null, body: blocks };
  const heading = inlinesOf(first);
  return heading === null ? { heading: null, body: blocks } : { heading, body: blocks.slice(1) };
};

const attributionPattern = /^\s*[—–-]\s*(.+)$/u;

const plain = (content: ReadonlyArray<Inline>) => content.map((part) => part.text).join("");

/** Retire la dernière ligne « — Auteur » du corps et la renvoie comme attribution. */
const splitAttribution = (
  blocks: ReadonlyArray<Block>,
): { body: ReadonlyArray<Block>; attribution: ReadonlyArray<Inline> | null } => {
  const last = blocks.at(-1);
  if (last === undefined || last._tag !== "Paragraph") return { body: blocks, attribution: null };
  const line = last.lines.at(-1);
  if (line === undefined) return { body: blocks, attribution: null };
  const match = attributionPattern.exec(plain(line));
  if (match === null) return { body: blocks, attribution: null };

  // Le tiret n'est retiré que du premier fragment ; les marques (gras, italique) sont conservées.
  let removed = false;
  const attribution = line.flatMap((part) => {
    if (removed) return [part];
    const text = part.text.replace(attributionPattern, "$1").trimStart();
    removed = text !== part.text;
    return text === "" ? [] : [{ ...part, text }];
  });

  const remainingLines = last.lines.slice(0, -1);
  const body =
    remainingLines.length === 0
      ? blocks.slice(0, -1)
      : [...blocks.slice(0, -1), { _tag: "Paragraph" as const, lines: remainingLines }];
  return { body, attribution };
};

export const applyLayout = (layout: SlideLayout, blocks: ReadonlyArray<Block>): LayoutedSlide => {
  switch (layout) {
    case "free":
      return { heading: null, body: blocks, attribution: null, quoted: false };
    case "title":
    case "titleBody": {
      const { heading, body } = splitHeading(blocks);
      return { heading, body, attribution: null, quoted: false };
    }
    case "quote": {
      const { body, attribution } = splitAttribution(blocks);
      return { heading: null, body, attribution, quoted: true };
    }
  }
};
