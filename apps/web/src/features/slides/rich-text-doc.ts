import { type Inline, parseRichText } from "@projection/slides/domain";
import type { JSONContent } from "@tiptap/react";

/**
 * Conversion entre la source des diapos texte (`# titre`, `**gras**`, `- liste`) et le
 * document de l'éditeur Tiptap. La source reste le format enregistré.
 */
const inlineToNodes = (content: ReadonlyArray<Inline>): Array<JSONContent> =>
  content
    .filter((part) => part.text !== "")
    .map((part) => {
      const marks = [
        ...(part.bold ? [{ type: "bold" }] : []),
        ...(part.italic ? [{ type: "italic" }] : []),
      ];
      return marks.length > 0
        ? { type: "text", text: part.text, marks }
        : { type: "text", text: part.text };
    });

export const sourceToDoc = (source: string): JSONContent => {
  const content = parseRichText(source).map((block): JSONContent => {
    switch (block._tag) {
      case "Heading":
        return {
          type: "heading",
          attrs: { level: block.level },
          content: inlineToNodes(block.content),
        };
      case "Paragraph":
        return {
          type: "paragraph",
          content: block.lines.flatMap((line, index) => [
            ...(index > 0 ? [{ type: "hardBreak" }] : []),
            ...inlineToNodes(line),
          ]),
        };
      case "List":
        return {
          type: "bulletList",
          content: block.items.map((item) => ({
            type: "listItem",
            content: [{ type: "paragraph", content: inlineToNodes(item) }],
          })),
        };
    }
  });
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
};

interface Run {
  text: string;
  readonly bold: boolean;
  readonly italic: boolean;
}

const hasMark = (node: JSONContent, type: string) =>
  node.marks?.some((mark) => mark.type === type) ?? false;

const inlineToSource = (nodes: ReadonlyArray<JSONContent> = []): string => {
  const runs: Array<Run> = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      runs.push({ text: "\n", bold: false, italic: false });
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const bold = hasMark(node, "bold");
    const italic = hasMark(node, "italic");
    const last = runs.at(-1);
    if (last !== undefined && last.text !== "\n" && last.bold === bold && last.italic === italic) {
      last.text += node.text;
    } else {
      runs.push({ text: node.text, bold, italic });
    }
  }
  return runs
    .map((run) => {
      if (run.text === "\n" || (!run.bold && !run.italic)) return run.text;
      const marker = run.bold && run.italic ? "***" : run.bold ? "**" : "*";
      // Les espaces restent hors des marqueurs : `** gras **` ne serait pas reconnu.
      const [, before = "", core = "", after = ""] = /^(\s*)([\s\S]*?)(\s*)$/.exec(run.text) ?? [];
      return core === "" ? run.text : `${before}${marker}${core}${marker}${after}`;
    })
    .join("");
};

const singleLine = (text: string) => text.replace(/\n/g, " ");

export const docToSource = (doc: JSONContent): string =>
  (doc.content ?? [])
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `${block.attrs?.level === 2 ? "##" : "#"} ${singleLine(inlineToSource(block.content))}`;
        case "bulletList":
          return (block.content ?? [])
            .map(
              (item) =>
                `- ${singleLine((item.content ?? []).map((part) => inlineToSource(part.content)).join(" "))}`,
            )
            .join("\n");
        case "paragraph":
          return inlineToSource(block.content);
        default:
          return "";
      }
    })
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
