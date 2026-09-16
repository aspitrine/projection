import { Schema } from "effect";
import { unzipSync } from "fflate";

import {
  type VideoPsalmValue,
  asArray,
  asNumber,
  asRecord,
  asText,
  parseVideoPsalmValue,
} from "./VideoPsalmValue";

/**
 * Import d'un agenda VideoPsalm (`.vpagd`) : archive ZIP contenant un `Song_N.json`
 * par élément et un `AgendaItemProperties.json` donnant l'ordre. Voir docs/formats/videopsalm.md.
 */
export class InvalidVideoPsalm extends Schema.TaggedError<InvalidVideoPsalm>()(
  "InvalidVideoPsalm",
  { reason: Schema.Literals(["NotAnArchive", "NoSongs"]) },
) {}

export interface ImportedVideoPsalmSong {
  /** `Guid` du chant : sert au dédoublonnage entre imports. */
  readonly externalId: string;
  readonly title: string;
  readonly authors: string | null;
  readonly copyright: string | null;
  readonly key: string | null;
  readonly reference: string | null;
  readonly notes: string | null;
  /** Paroles au format texte à balises, prêtes pour `parseLyrics`. */
  readonly lyrics: string;
}

export interface ImportedAgenda {
  readonly songs: ReadonlyArray<ImportedVideoPsalmSong>;
}

/** Tags observés dans les fichiers VideoPsalm (voir docs/formats/videopsalm.md). */
const tagNames: Record<number, string> = {
  1: "Refrain",
  2: "Pré-refrain",
  3: "Pont",
  8: "Intro",
  9: "Fin",
};

const chordPattern = /\[[^\]]*\]/g;

/** Retire les accords, recompose les accents coupés par un accord, nettoie les artefacts. */
export const cleanVerseText = (raw: string): ReadonlyArray<string> =>
  raw
    .replace(/\r\n?/g, "\n")
    .replace(chordPattern, "")
    .normalize("NFC")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "" && line !== ".");

const cleanText = (value: string | null) => {
  const trimmed = value?.replace(/\s+/g, " ").trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

/** « Inconnu - Inconnu » et ses variantes ne sont pas des auteurs. */
const cleanAuthors = (value: string | null) => {
  const authors = cleanText(value);
  if (authors === null) return null;
  const meaningful = authors
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter((part) => part !== "" && part.toLowerCase() !== "inconnu");
  return meaningful.length === 0 ? null : meaningful.join(", ");
};

interface Section {
  readonly label: string;
  readonly lines: ReadonlyArray<string>;
}

/**
 * Sections dans l'ordre de passage : les répétitions ne sont écrites qu'une fois,
 * les suivantes deviennent une balise seule (rejeu), et les sections sans texte
 * projetable (accords seuls) sont ignorées.
 */
const toLyrics = (verses: ReadonlyArray<VideoPsalmValue>): string => {
  const sections = new Map<string, Section>();
  const order: Array<string> = [];
  let verseNumber = 0;

  for (const verse of verses) {
    const record = asRecord(verse);
    if (record === null) continue;
    const lines = cleanVerseText(asText(record.Text) ?? "");
    if (lines.length === 0) continue;

    const tag = asNumber(record.Tag);
    const key = `${tag ?? "verse"}|${lines.join("\n")}`;
    const existing = sections.get(key);
    if (existing !== undefined) {
      order.push(key);
      continue;
    }

    let label: string;
    if (tag === null || tag === undefined) {
      verseNumber += 1;
      label = `Couplet ${verseNumber}`;
    } else {
      label = tagNames[tag] ?? `Section ${tag}`;
    }
    sections.set(key, { label, lines });
    order.push(key);
  }

  const written = new Set<string>();
  return order
    .flatMap((key) => {
      const section = sections.get(key);
      if (section === undefined) return [];
      if (written.has(key)) return [`[${section.label}]`];
      written.add(key);
      return [[`[${section.label}]`, ...section.lines].join("\n")];
    })
    .join("\n\n");
};

const toSong = (source: string): ImportedVideoPsalmSong | null => {
  const record = asRecord(parseVideoPsalmValue(source));
  if (record === null) return null;

  const title = cleanText(asText(record.Text));
  const externalId = cleanText(asText(record.Guid));
  const lyrics = toLyrics(asArray(record.Verses));
  if (title === null || externalId === null || lyrics === "") return null;

  return {
    externalId,
    title,
    authors: cleanAuthors(asText(record.Author)),
    copyright: cleanText(asText(record.Copyright)),
    key: cleanText(asText(record.Key)),
    reference: cleanText(asText(record.Reference)),
    notes: cleanText(asText(record.Memo1)),
    lyrics,
  };
};

const songEntryIndex = (name: string) => {
  const match = /^Song_(\d+)\.json$/.exec(name);
  return match === null ? null : Number(match[1]);
};

/** Lit l'archive et rend les chants dans l'ordre de l'agenda. */
export const parseVideoPsalmAgenda = (archive: Uint8Array): ImportedAgenda | InvalidVideoPsalm => {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(archive);
  } catch {
    return new InvalidVideoPsalm({ reason: "NotAnArchive" });
  }

  const decoder = new TextDecoder("utf-8");
  const songs = Object.entries(entries)
    .flatMap(([name, bytes]) => {
      const index = songEntryIndex(name);
      return index === null ? [] : [{ index, bytes }];
    })
    .sort((left, right) => left.index - right.index)
    .flatMap(({ bytes }) => {
      const song = toSong(decoder.decode(bytes));
      return song === null ? [] : [song];
    });

  return songs.length === 0 ? new InvalidVideoPsalm({ reason: "NoSongs" }) : { songs };
};
