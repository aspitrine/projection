/**
 * Extraction des versets d'un livre au format USFM (https://ubsicap.github.io/usfm/).
 *
 * - Seuls le texte des versets est conservé : introductions, titres de sections,
 *   références croisées (`\x…\x*`), notes (`\f…\f*`) et en-têtes sont ignorés.
 * - Les marqueurs de caractères (`\w mot|strong="…"\w*`, `\wj`, `\it`…) sont retirés.
 * - Les lignes de poésie (`\q1`, `\p`, `\m`…) sans `\v` prolongent le verset en cours.
 */
export interface UsfmVerse {
  readonly chapter: number;
  readonly verse: number;
  readonly text: string;
}

export interface UsfmBook {
  readonly code: string;
  readonly verses: ReadonlyArray<UsfmVerse>;
}

/** Paragraphes dont le texte n'appartient à aucun verset. */
const nonVerseMarkers = new Set([
  "id",
  "ide",
  "h",
  "toc1",
  "toc2",
  "toc3",
  "mt",
  "mt1",
  "mt2",
  "mt3",
  "ms",
  "ms1",
  "ms2",
  "mr",
  "s",
  "s1",
  "s2",
  "s3",
  "sr",
  "r",
  "d",
  "sp",
  "cl",
  "cd",
  "rem",
  "imt",
  "imt1",
  "imt2",
  "imt3",
  "is",
  "is1",
  "is2",
  "ip",
  "ipi",
  "im",
  "io",
  "io1",
  "io2",
  "io3",
  "ior",
  "iot",
  "ili",
  "ib",
  "ie",
  "iex",
]);

const cleanInline = (text: string) =>
  text
    .replace(/\\x\s[\s\S]*?\\x\*/g, "")
    .replace(/\\f\s[\s\S]*?\\f\*/g, "")
    .replace(/\\\+?w\s([^\\|]*)(?:\|[^\\]*)?\\\+?w\*/g, "$1")
    .replace(/\\\+?[a-z]+\d*\*?/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const parseUsfm = (content: string): UsfmBook => {
  let code = "";
  let chapter = 0;
  let current: { verse: number; parts: Array<string> } | null = null;
  const verses: Array<UsfmVerse> = [];

  const closeVerse = () => {
    if (current !== null) {
      const text = cleanInline(current.parts.join(" "));
      if (text !== "") verses.push({ chapter, verse: current.verse, text });
    }
    current = null;
  };

  for (const rawLine of content.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;

    const marker = /^\\([a-z]+\d*)\s*(.*)$/.exec(line);
    if (marker === null) {
      current?.parts.push(line);
      continue;
    }

    const [, name = "", rest = ""] = marker;

    if (name === "id") {
      code = rest.split(/\s+/)[0] ?? "";
    } else if (name === "c") {
      closeVerse();
      chapter = Number.parseInt(rest, 10);
    } else if (name === "v") {
      closeVerse();
      const verseMatch = /^(\d+)\S*\s*(.*)$/.exec(rest);
      if (verseMatch !== null && chapter > 0) {
        current = { verse: Number(verseMatch[1]), parts: [verseMatch[2] ?? ""] };
      }
    } else if (!nonVerseMarkers.has(name)) {
      // Paragraphe de continuation (\p, \q1, \m, \b, \tr…) : peut contenir un \v en ligne.
      const inlineVerse = /\\v\s/.exec(rest);
      if (inlineVerse === null) {
        current?.parts.push(rest);
      } else {
        current?.parts.push(rest.slice(0, inlineVerse.index));
        closeVerse();
        const verseMatch = /^\\v\s+(\d+)\S*\s*(.*)$/.exec(rest.slice(inlineVerse.index));
        if (verseMatch !== null && chapter > 0) {
          current = { verse: Number(verseMatch[1]), parts: [verseMatch[2] ?? ""] };
        }
      }
    }
  }
  closeVerse();

  return { code, verses };
};
