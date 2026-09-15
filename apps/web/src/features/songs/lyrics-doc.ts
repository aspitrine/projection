import { type SectionType, parseTag } from "@projection/songs/domain";
import type { JSONContent } from "@tiptap/react";

/**
 * Conversion entre le texte des paroles (`[Couplet 1]`, une ligne par ligne chantée) et le
 * document de l'éditeur : chaque balise devient une étiquette de section, chaque ligne un paragraphe.
 */
const tagLine = /^\[(.+)\]$/;

export const lyricsToDoc = (lyrics: string): JSONContent => {
  const lines = lyrics.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 1 && lines.at(-1)?.trim() === "") lines.pop();
  return {
    type: "doc",
    content: lines.map((raw): JSONContent => {
      const line = raw.trim();
      const tag = tagLine.exec(line)?.[1]?.trim();
      if (tag) return { type: "sectionTag", content: [{ type: "text", text: tag }] };
      return line === ""
        ? { type: "paragraph" }
        : { type: "paragraph", content: [{ type: "text", text: line }] };
    }),
  };
};

export const docToLyrics = (doc: JSONContent): string =>
  (doc.content ?? [])
    .map((block) => {
      const text = (block.content ?? []).map((node) => node.text ?? "").join("");
      if (block.type !== "sectionTag") return text;
      return text.trim() === "" ? "" : `[${text.trim()}]`;
    })
    .join("\n")
    .replace(/\s+$/, "");

/** Balises canoniques insérées par la barre d'outils (format de données, pas de l'interface). */
const canonicalTags = {
  verse: "Couplet",
  pre_chorus: "Pré-refrain",
  chorus: "Refrain",
  bridge: "Pont",
  intro: "Intro",
  ending: "Fin",
} as const satisfies Partial<Record<SectionType, string>>;

export type InsertableSection = keyof typeof canonicalTags;

/** Libellé de la prochaine balise : les couplets sont numérotés à la suite. */
export const nextSectionLabel = (lyrics: string, type: InsertableSection): string => {
  if (type !== "verse") return canonicalTags[type];
  const highest = lyrics
    .split("\n")
    .flatMap((line) => {
      const tag = tagLine.exec(line.trim())?.[1];
      if (tag === undefined) return [];
      const parsed = parseTag(tag);
      return parsed.type === "verse" && parsed.number !== null ? [parsed.number] : [];
    })
    .reduce((max, number) => Math.max(max, number), 0);
  return `${canonicalTags.verse} ${highest + 1}`;
};
