import { type BookCode, bookCodes } from "./Books";

/**
 * Lecture des formats XML d'échange biblique : OSIS et Zefania.
 * Les deux portent une Bible entière ; on n'en garde que le texte des versets,
 * livre par livre, dans le canon protestant (les autres livres sont ignorés).
 */
export interface ParsedVerse {
  readonly chapter: number;
  readonly verse: number;
  readonly text: string;
}

export interface ParsedBook {
  readonly code: BookCode;
  readonly verses: ReadonlyArray<ParsedVerse>;
}

/** Identifiants OSIS des 66 livres, dans le même ordre que `bookCodes`. */
const osisIds = [
  "Gen",
  "Exod",
  "Lev",
  "Num",
  "Deut",
  "Josh",
  "Judg",
  "Ruth",
  "1Sam",
  "2Sam",
  "1Kgs",
  "2Kgs",
  "1Chr",
  "2Chr",
  "Ezra",
  "Neh",
  "Esth",
  "Job",
  "Ps",
  "Prov",
  "Eccl",
  "Song",
  "Isa",
  "Jer",
  "Lam",
  "Ezek",
  "Dan",
  "Hos",
  "Joel",
  "Amos",
  "Obad",
  "Jonah",
  "Mic",
  "Nah",
  "Hab",
  "Zeph",
  "Hag",
  "Zech",
  "Mal",
  "Matt",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Rom",
  "1Cor",
  "2Cor",
  "Gal",
  "Eph",
  "Phil",
  "Col",
  "1Thess",
  "2Thess",
  "1Tim",
  "2Tim",
  "Titus",
  "Phlm",
  "Heb",
  "Jas",
  "1Pet",
  "2Pet",
  "1John",
  "2John",
  "3John",
  "Jude",
  "Rev",
] as const;

const byOsisId = new Map<string, BookCode>(
  osisIds.map((id, index) => [id.toLowerCase(), bookCodes[index] as BookCode]),
);

/** `Gen`, `1Cor`, et les variantes courantes (`Ps`/`Psa`, `Phlm`/`Phm`). */
export const bookCodeOfOsisId = (osisId: string): BookCode | null => {
  const key = osisId.split(".")[0]?.toLowerCase() ?? "";
  const aliases: Record<string, string> = { psa: "ps", phm: "phlm", canticles: "song" };
  return byOsisId.get(aliases[key] ?? key) ?? null;
};

/** Numéro Zefania (1 = Genèse, 66 = Apocalypse). */
export const bookCodeOfNumber = (bookNumber: number): BookCode | null =>
  (bookCodes[bookNumber - 1] as BookCode | undefined) ?? null;

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const decode = (value: string) =>
  value.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)));
    return entities[entity] ?? match;
  });

/** Texte lisible : balises retirées, notes et références croisées écartées. */
const plainText = (xml: string) =>
  decode(
    xml
      .replace(/<note\b[\s\S]*?<\/note>/g, "")
      .replace(/<reference\b[\s\S]*?<\/reference>/g, "")
      .replace(/<NOTE\b[\s\S]*?<\/NOTE>/g, "")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();

const collect = (entries: ReadonlyArray<{ code: BookCode; verse: ParsedVerse }>) => {
  const books = new Map<BookCode, Array<ParsedVerse>>();
  for (const { code, verse } of entries) {
    if (verse.text === "") continue;
    const verses = books.get(code) ?? [];
    verses.push(verse);
    books.set(code, verses);
  }
  return [...books.entries()].map(([code, verses]) => ({ code, verses }));
};

const osisContainer = /<verse\b[^>]*osisID="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/g;
const osisMilestone = /<verse\b[^>]*osisID="([^"]+)"[^>]*sID="[^"]*"[^>]*\/>/g;

/**
 * OSIS : les versets sont soit des éléments contenant leur texte, soit des jalons
 * (`sID`/`eID`) encadrant le texte. Les deux écritures sont acceptées.
 */
export const parseOsis = (xml: string): ReadonlyArray<ParsedBook> => {
  const entries: Array<{ code: BookCode; verse: ParsedVerse }> = [];

  for (const match of xml.matchAll(osisContainer)) {
    const [, osisId = "", body = ""] = match;
    const parts = osisId.split(".");
    const code = bookCodeOfOsisId(osisId);
    if (code === null || parts.length < 3) continue;
    entries.push({
      code,
      verse: { chapter: Number(parts[1]), verse: Number(parts[2]), text: plainText(body) },
    });
  }

  if (entries.length === 0) {
    // Écriture par jalons : le texte va d'un `sID` au suivant.
    const milestones = [...xml.matchAll(osisMilestone)];
    milestones.forEach((match, index) => {
      const [, osisId = ""] = match;
      const parts = osisId.split(".");
      const code = bookCodeOfOsisId(osisId);
      if (code === null || parts.length < 3) return;
      const start = (match.index ?? 0) + match[0].length;
      const end = milestones[index + 1]?.index ?? xml.length;
      const body = xml.slice(start, end).split("</div>")[0] ?? "";
      entries.push({
        code,
        verse: { chapter: Number(parts[1]), verse: Number(parts[2]), text: plainText(body) },
      });
    });
  }

  return collect(entries);
};

const zefaniaBook = /<BIBLEBOOK\b[^>]*bnumber="(\d+)"[^>]*>([\s\S]*?)<\/BIBLEBOOK>/gi;
const zefaniaChapter = /<CHAPTER\b[^>]*cnumber="(\d+)"[^>]*>([\s\S]*?)<\/CHAPTER>/gi;
const zefaniaVerse = /<VERS\b[^>]*vnumber="(\d+)"[^>]*>([\s\S]*?)<\/VERS>/gi;

/** Zefania : `<BIBLEBOOK bnumber><CHAPTER cnumber><VERS vnumber>texte`. */
export const parseZefania = (xml: string): ReadonlyArray<ParsedBook> => {
  const entries: Array<{ code: BookCode; verse: ParsedVerse }> = [];

  for (const book of xml.matchAll(zefaniaBook)) {
    const code = bookCodeOfNumber(Number(book[1]));
    if (code === null) continue;
    for (const chapter of (book[2] ?? "").matchAll(zefaniaChapter)) {
      const chapterNumber = Number(chapter[1]);
      for (const verse of (chapter[2] ?? "").matchAll(zefaniaVerse)) {
        entries.push({
          code,
          verse: {
            chapter: chapterNumber,
            verse: Number(verse[1]),
            text: plainText(verse[2] ?? ""),
          },
        });
      }
    }
  }

  return collect(entries);
};

/** Reconnaît le format d'un fichier XML biblique. */
export const detectXmlFormat = (xml: string): "osis" | "zefania" | null => {
  const head = xml.slice(0, 4000);
  if (/<osis\b|osisID=/i.test(head)) return "osis";
  if (/<XMLBIBLE\b|<BIBLEBOOK\b/i.test(head)) return "zefania";
  return null;
};
