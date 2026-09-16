import { XMLParser } from "fast-xml-parser";

import type { ImportedSong } from "./ChordPro";

/**
 * Import OpenLyrics (`.xml`) : format d'échange de paroles (OpenLP, Eliakim…).
 *
 * - Métadonnées dans `<properties>` : titre, auteurs, copyright, numéro CCLI, ordre de passage.
 * - Paroles dans `<lyrics>` : un `<verse name="v1">` par section, `<lines>` pour les lignes
 *   (un bloc par ligne chez certains exporteurs, sinon séparées par `<br/>`).
 * - Accords en éléments `<chord name="A"/>` **au milieu du texte** : ils sont retirés.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: false,
  // Un chant d'une seule section ne doit pas se lire différemment d'un chant qui en a plusieurs.
  isArray: (name) => name === "verse" || name === "lines" || name === "title" || name === "author",
});

/** Préfixes de nom de section OpenLyrics (insensibles à la casse). */
const sectionNames: ReadonlyArray<readonly [RegExp, string]> = [
  [/^v(\d*)$/, "Couplet"],
  [/^c(\d*)$/, "Refrain"],
  [/^p(\d*)$/, "Pré-refrain"],
  [/^b(\d*)$/, "Pont"],
  [/^i(\d*)$/, "Intro"],
  [/^e(\d*)$/, "Fin"],
  [/^t(\d*)$/, "Tag"],
];

/** `v2` → « Couplet 2 », `c` → « Refrain », `misc` → « Misc ». */
export const sectionLabelOf = (name: string): string => {
  const normalized = name.trim().toLowerCase();
  for (const [pattern, label] of sectionNames) {
    const match = pattern.exec(normalized);
    if (match !== null) {
      const number = match[1];
      return number === undefined || number === "" ? label : `${label} ${number}`;
    }
  }
  return name.trim();
};

const text = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (typeof value === "object" && value !== null) {
    return text((value as { readonly "#text"?: unknown })["#text"]);
  }
  return "";
};

const cleanValue = (value: unknown) => {
  const result = text(value).replace(/\s+/g, " ").trim();
  return result === "" ? null : result;
};

const cleanLines = (value: unknown): ReadonlyArray<string> =>
  text(value)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");

/** Retire accords et commentaires, et transforme les sauts de ligne en vrais retours. */
const prepare = (source: string) =>
  source
    .replace(/<comment\b[\s\S]*?<\/comment>/g, "")
    .replace(/<chord\b[^>]*\/>/g, "")
    .replace(/<chord\b[^>]*>([\s\S]*?)<\/chord>/g, "$1")
    .replace(/<br\s*\/?>/g, "\n");

interface Section {
  readonly name: string;
  readonly label: string;
  readonly lines: ReadonlyArray<string>;
}

export const parseOpenLyrics = (source: string, fallbackTitle: string): ImportedSong | null => {
  const document = parser.parse(prepare(source)) as Record<string, unknown>;
  const song = document.song as Record<string, unknown> | undefined;
  if (song === undefined) return null;

  const properties = (song.properties ?? {}) as Record<string, unknown>;
  const titles = (properties.titles ?? {}) as Record<string, unknown>;
  const authors = (properties.authors ?? {}) as Record<string, unknown>;
  const lyrics = (song.lyrics ?? {}) as Record<string, unknown>;
  const verses = Array.isArray(lyrics.verse) ? lyrics.verse : [];

  const sections: Array<Section> = [];
  for (const verse of verses) {
    const record = verse as Record<string, unknown>;
    const name = cleanValue(record["@_name"]) ?? "";
    const lines = (Array.isArray(record.lines) ? record.lines : [record.lines]).flatMap(cleanLines);
    if (lines.length === 0) continue;
    sections.push({ name: name.toLowerCase(), label: sectionLabelOf(name), lines });
  }
  if (sections.length === 0) return null;

  // `verseOrder` donne l'ordre de passage ; sinon, l'ordre d'écriture.
  const order = (cleanValue(properties.verseOrder) ?? "")
    .split(/\s+/)
    .map((name) => name.toLowerCase())
    .filter((name) => name !== "");
  const arrangement = order.length > 0 ? order : sections.map((section) => section.name);

  const written = new Set<string>();
  const body = arrangement.flatMap((name) => {
    const section = sections.find((candidate) => candidate.name === name);
    if (section === undefined) return [];
    if (written.has(name)) return [`[${section.label}]`];
    written.add(name);
    return [[`[${section.label}]`, ...section.lines].join("\n")];
  });
  // Une section jamais citée dans `verseOrder` reste importée, à la suite.
  const missing = sections
    .filter((section) => !written.has(section.name))
    .map((section) => [`[${section.label}]`, ...section.lines].join("\n"));

  const authorList = Array.isArray(authors.author) ? authors.author : [];
  const titleList = Array.isArray(titles.title) ? titles.title : [];

  return {
    title: cleanValue(titleList[0]) ?? fallbackTitle,
    authors:
      authorList.length === 0
        ? null
        : authorList
            .map(cleanValue)
            .filter((author) => author !== null)
            .join(", ") || null,
    copyright: cleanValue(properties.copyright),
    ccli: cleanValue(properties.ccliNo),
    lyrics: [...body, ...missing].join("\n\n"),
  };
};
