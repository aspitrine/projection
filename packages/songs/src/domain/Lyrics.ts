import { Effect } from "effect";

import { InvalidLyrics } from "./errors";
import { type SectionId, type SectionType, SongSection, sectionId } from "./SongSection";

/**
 * Format texte des paroles :
 *
 * ```
 * [Couplet 1]
 * Première ligne
 * [Refrain]
 * Ligne du refrain
 * [Couplet 2]
 * …
 * [Refrain]        ← balise sans texte : rejoue la section
 * ```
 *
 * Sans balise, chaque strophe séparée par une ligne vide devient un couplet.
 * Balises reconnues (insensibles à la casse et aux accents), en français ou en
 * anglais : Couplet/Verse/C, Refrain/Chorus/R, Pré-refrain/Pre-chorus, Pont/Bridge/P,
 * Intro, Interlude/Instrumental, Fin/Outro/Ending, Tag. Toute autre balise crée
 * une section libre (ex. « [Solo] »).
 */
export interface ParsedLyrics {
  readonly sections: ReadonlyArray<SongSection>;
  readonly arrangement: ReadonlyArray<SectionId>;
}

const tagAliases: ReadonlyArray<readonly [SectionType, ReadonlyArray<string>]> = [
  [
    "pre_chorus",
    ["pre-refrain", "prerefrain", "pre refrain", "pre-chorus", "prechorus", "pre chorus", "pr"],
  ],
  ["verse", ["couplet", "verse", "strophe", "c", "v"]],
  ["chorus", ["refrain", "chorus", "r"]],
  ["bridge", ["pont", "bridge", "p"]],
  ["intro", ["intro"]],
  ["interlude", ["interlude", "instrumental"]],
  ["ending", ["fin", "outro", "ending", "coda"]],
  ["tag", ["tag"]],
];

const normalizeTag = (tag: string) =>
  tag
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

interface ParsedTag {
  readonly type: SectionType;
  readonly number: number | null;
  readonly label: string | null;
  readonly raw: string;
}

export const parseTag = (raw: string): ParsedTag => {
  const match = /^(.*?)\s*(\d+)?$/.exec(normalizeTag(raw));
  const name = match?.[1] ?? "";
  const number = match?.[2] === undefined ? null : Number(match[2]);
  for (const [type, aliases] of tagAliases) {
    if (aliases.includes(name)) {
      return { type, number, label: null, raw };
    }
  }
  return { type: "other", number: null, label: raw.trim(), raw };
};

const tagPattern = /^\[(.+)\]$/;

interface Draft {
  readonly tag: ParsedTag | null;
  readonly lines: Array<string>;
}

export const parseLyrics = Effect.fnUntraced(function* (text: string) {
  const sections = new Map<SectionId, SongSection>();
  const arrangement: Array<SectionId> = [];
  let lastVerseNumber = 0;
  let draft: Draft | null = null;

  const flush = function* () {
    const current = draft;
    draft = null;
    if (current === null) return;

    const tag = current.tag ?? {
      type: "verse" as const,
      number: null,
      label: null,
      raw: "Couplet",
    };
    const isRepeat = current.lines.length === 0;

    let number = tag.number;
    if (tag.type === "verse") {
      if (number === null) {
        if (isRepeat) {
          return yield* new InvalidLyrics({ reason: "UndefinedRepeat", tag: tag.raw });
        }
        number = lastVerseNumber + 1;
      }
      lastVerseNumber = Math.max(lastVerseNumber, number);
    }

    const id = sectionId(tag.type, number, tag.label);
    const existing = sections.get(id);

    if (isRepeat) {
      if (existing === undefined) {
        return yield* new InvalidLyrics({ reason: "UndefinedRepeat", tag: tag.raw });
      }
    } else if (existing === undefined) {
      sections.set(
        id,
        new SongSection({ id, type: tag.type, number, label: tag.label, lines: current.lines }),
      );
    } else if (existing.lines.join("\n") !== current.lines.join("\n")) {
      return yield* new InvalidLyrics({ reason: "DuplicateSection", tag: tag.raw });
    }
    arrangement.push(id);
  };

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    const tagMatch = tagPattern.exec(line);

    if (tagMatch?.[1] !== undefined) {
      yield* flush();
      draft = { tag: parseTag(tagMatch[1]), lines: [] };
    } else if (line === "") {
      // Une ligne vide termine un couplet implicite (strophe sans balise).
      if (draft !== null && draft.tag === null && draft.lines.length > 0) {
        yield* flush();
      }
    } else {
      if (draft === null) {
        draft = { tag: null, lines: [] };
      }
      draft.lines.push(line);
    }
  }
  yield* flush();

  if (sections.size === 0) {
    return yield* new InvalidLyrics({ reason: "Empty", tag: null });
  }

  return { sections: [...sections.values()], arrangement } satisfies ParsedLyrics;
});

const canonicalTags: Record<Exclude<SectionType, "other">, string> = {
  verse: "Couplet",
  pre_chorus: "Pré-refrain",
  chorus: "Refrain",
  bridge: "Pont",
  intro: "Intro",
  interlude: "Interlude",
  ending: "Fin",
  tag: "Tag",
};

export const formatTag = (section: SongSection) => {
  const name =
    section.type === "other" ? (section.label ?? "Section") : canonicalTags[section.type];
  return section.number === null ? name : `${name} ${section.number}`;
};

/** Inverse de `parseLyrics` : une section n'est écrite qu'à sa première occurrence. */
export const formatLyrics = (lyrics: ParsedLyrics): string => {
  const byId = new Map(lyrics.sections.map((section) => [section.id, section]));
  const written = new Set<SectionId>();
  const parts: Array<string> = [];
  for (const id of lyrics.arrangement) {
    const section = byId.get(id);
    if (section === undefined) continue;
    const tag = `[${formatTag(section)}]`;
    parts.push(written.has(id) ? tag : [tag, ...section.lines].join("\n"));
    written.add(id);
  }
  return parts.join("\n\n");
};
