/**
 * Texte enrichi léger des diapos :
 *
 * ```
 * # Titre
 * ## Sous-titre
 * Un paragraphe avec du **gras**, de l'*italique* ou _italique_, et du ***gras italique***.
 * Une deuxième ligne du même paragraphe.
 *
 * - premier élément de liste
 * - second élément
 * ```
 *
 * Une ligne vide sépare les paragraphes. Les marques ne s'imbriquent pas (hors `***`).
 * Le parseur ne peut pas échouer : un marqueur non fermé reste du texte.
 */
export interface Inline {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
}

export type Block =
  | { readonly _tag: "Heading"; readonly level: 1 | 2; readonly content: ReadonlyArray<Inline> }
  | { readonly _tag: "Paragraph"; readonly lines: ReadonlyArray<ReadonlyArray<Inline>> }
  | { readonly _tag: "List"; readonly items: ReadonlyArray<ReadonlyArray<Inline>> };

const inlinePattern =
  /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(\S(?:.*?\S)?)\*|(?<![\p{L}\p{N}])_(.+?)_(?![\p{L}\p{N}])/gu;

export const parseInline = (text: string): ReadonlyArray<Inline> => {
  const result: Array<Inline> = [];
  const push = (value: string, bold: boolean, italic: boolean) => {
    if (value === "") return;
    const previous = result.at(-1);
    if (previous !== undefined && previous.bold === bold && previous.italic === italic) {
      result[result.length - 1] = { text: previous.text + value, bold, italic };
    } else {
      result.push({ text: value, bold, italic });
    }
  };

  let offset = 0;
  for (const match of text.matchAll(inlinePattern)) {
    push(text.slice(offset, match.index), false, false);
    const [, boldItalic, bold, starItalic, underscoreItalic] = match;
    if (boldItalic !== undefined) push(boldItalic, true, true);
    else if (bold !== undefined) push(bold, true, false);
    else push(starItalic ?? underscoreItalic ?? "", false, true);
    offset = match.index + match[0].length;
  }
  push(text.slice(offset), false, false);
  return result;
};

export const parseRichText = (source: string): ReadonlyArray<Block> => {
  const blocks: Array<Block> = [];
  let paragraph: Array<ReadonlyArray<Inline>> | null = null;
  let list: Array<ReadonlyArray<Inline>> | null = null;

  const flushParagraph = () => {
    if (paragraph !== null) blocks.push({ _tag: "Paragraph", lines: paragraph });
    paragraph = null;
  };
  const flushList = () => {
    if (list !== null) blocks.push({ _tag: "List", items: list });
    list = null;
  };

  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    // Un marqueur de titre ou de liste sans texte équivaut à une ligne vide.
    if (line === "" || /^(#{1,2}|[-*•])$/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,2})\s+(.+)$/.exec(line);
    const item = /^[-*•]\s+(.+)$/.exec(line);

    if (heading !== null) {
      flushParagraph();
      flushList();
      blocks.push({
        _tag: "Heading",
        level: heading[1] === "#" ? 1 : 2,
        content: parseInline(heading[2] ?? ""),
      });
    } else if (item !== null) {
      flushParagraph();
      list ??= [];
      list.push(parseInline(item[1] ?? ""));
    } else {
      flushList();
      paragraph ??= [];
      paragraph.push(parseInline(line));
    }
  }
  flushParagraph();
  flushList();
  return blocks;
};

const plain = (content: ReadonlyArray<Inline>) => content.map((part) => part.text).join("");

/** Vrai si le contenu affiche au moins un caractère visible (hors marqueurs). */
export const hasVisibleContent = (source: string) =>
  parseRichText(source).some((block) => {
    const parts =
      block._tag === "Heading"
        ? [block.content]
        : block._tag === "Paragraph"
          ? block.lines
          : block.items;
    return parts.some((content) => plain(content).trim() !== "");
  });

/** Lignes de texte brut (recherche, découpage, accessibilité). */
export const plainLines = (blocks: ReadonlyArray<Block>): ReadonlyArray<string> =>
  blocks.flatMap((block) => {
    switch (block._tag) {
      case "Heading":
        return [plain(block.content)];
      case "Paragraph":
        return block.lines.map(plain);
      case "List":
        return block.items.map((item) => `• ${plain(item)}`);
    }
  });
