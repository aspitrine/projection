import { Effect, Schema } from "effect";

/**
 * Import ChordPro (`.cho`, `.chordpro`, `.chopro`, `.crd`, `.pro`) vers le format texte des paroles.
 *
 * - Métadonnées : `{title}`/`{t}`, `{artist}`/`{composer}`/`{lyricist}` (auteurs),
 *   `{copyright}`, `{ccli}`, et leurs équivalents `{meta: nom valeur}`.
 * - Sections : `{start_of_verse}`/`{sov}`, `{start_of_chorus}`/`{soc}`, `{start_of_bridge}`/`{sob}`
 *   (libellé facultatif, ex. `{sov: Couplet 2}`), `{chorus}` rejoue le refrain,
 *   `{comment: Refrain}` avant un bloc sert de libellé.
 * - Les accords `[G]` sont retirés ; tablatures et grilles sont ignorées.
 */
export interface ImportedSong {
  readonly title: string;
  readonly authors: string | null;
  readonly copyright: string | null;
  readonly ccli: string | null;
  readonly lyrics: string;
}

export class InvalidChordPro extends Schema.TaggedError<InvalidChordPro>()("InvalidChordPro", {
  reason: Schema.Literals(["NoLyrics"]),
}) {}

const directivePattern = /^\{\s*([A-Za-z_-]+)\s*(?::\s*(.*?))?\s*\}$/;
const chordPattern = /\[[^\]]*\]/g;

const sectionStarts: Record<string, string> = {
  start_of_verse: "Couplet",
  sov: "Couplet",
  start_of_chorus: "Refrain",
  soc: "Refrain",
  start_of_bridge: "Pont",
  sob: "Pont",
};

const sectionEnds = new Set([
  "end_of_verse",
  "eov",
  "end_of_chorus",
  "eoc",
  "end_of_bridge",
  "eob",
]);

/** Blocs non textuels (tablature, grille d'accords) : ignorés. */
const ignoredStarts: Record<string, string> = {
  start_of_tab: "end_of_tab",
  sot: "eot",
  start_of_grid: "end_of_grid",
  sog: "eog",
};

const commentDirectives = new Set([
  "comment",
  "c",
  "comment_italic",
  "ci",
  "comment_box",
  "cb",
  "highlight",
]);
const authorKeys = new Set(["artist", "composer", "lyricist", "author", "subtitle", "st"]);

interface Block {
  readonly label: string | null;
  readonly lines: Array<string>;
}

const stripChords = (line: string) => line.replace(chordPattern, "").replace(/\s+/g, " ").trim();

export const parseChordPro = Effect.fnUntraced(function* (text: string, fallbackTitle: string) {
  let title: string | null = null;
  const authors: Array<string> = [];
  let copyright: string | null = null;
  let ccli: string | null = null;

  const blocks: Array<Block> = [];
  let current: Block | null = null;
  let explicit = false;
  let pendingLabel: string | null = null;
  let ignoreUntil: string | null = null;
  let chorusDefined = false;

  const close = () => {
    if (current !== null && current.lines.length > 0) {
      blocks.push(current);
      if (current.label === "Refrain") chorusDefined = true;
    }
    current = null;
    explicit = false;
  };

  const setMeta = (key: string, value: string) => {
    const name = key.toLowerCase();
    if ((name === "title" || name === "t") && value !== "") title ??= value;
    else if (authorKeys.has(name) && value !== "" && !authors.includes(value)) authors.push(value);
    else if (name === "copyright" && value !== "") copyright ??= value;
    else if (name === "ccli" && value !== "") ccli ??= value.replace(/^#?\s*/, "");
  };

  for (const rawLine of text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();

    const directive = directivePattern.exec(line);
    if (ignoreUntil !== null) {
      if (directive?.[1]?.toLowerCase() === ignoreUntil) ignoreUntil = null;
      continue;
    }
    if (line.startsWith("#")) continue;

    if (directive !== null) {
      const name = (directive[1] ?? "").toLowerCase().replace(/-/g, "_");
      const value = (directive[2] ?? "").trim();

      if (name === "meta") {
        const [key = "", ...rest] = value.split(/\s+/);
        setMeta(key, rest.join(" "));
      } else if (name in sectionStarts) {
        close();
        current = { label: value === "" ? (sectionStarts[name] ?? null) : value, lines: [] };
        explicit = true;
      } else if (sectionEnds.has(name)) {
        close();
      } else if (name in ignoredStarts) {
        close();
        ignoreUntil = ignoredStarts[name] ?? null;
      } else if (name === "chorus") {
        close();
        if (chorusDefined) blocks.push({ label: "Refrain", lines: [] });
      } else if (commentDirectives.has(name)) {
        // Un commentaire hors section annonce souvent la suivante (« Refrain », « Couplet 2 »).
        if (!explicit && value !== "") {
          close();
          pendingLabel = value;
        }
      } else {
        setMeta(name, value);
      }
      continue;
    }

    if (line === "") {
      // Hors section explicite, une ligne vide sépare deux strophes.
      if (!explicit) close();
      continue;
    }

    const lyric = stripChords(line);
    // Ligne d'accords seule : ni texte ni séparation.
    if (lyric === "") continue;

    if (current === null) {
      current = { label: pendingLabel, lines: [] };
      pendingLabel = null;
    }
    current.lines.push(lyric);
  }
  close();

  if (blocks.every((block) => block.lines.length === 0)) {
    return yield* new InvalidChordPro({ reason: "NoLyrics" });
  }

  const lyrics = blocks
    .map((block) => [`[${block.label ?? "Couplet"}]`, ...block.lines].join("\n"))
    .join("\n\n");

  const song: ImportedSong = {
    title: title ?? fallbackTitle,
    authors: authors.length === 0 ? null : authors.join(", "),
    copyright,
    ccli,
    lyrics,
  };
  return song;
});
