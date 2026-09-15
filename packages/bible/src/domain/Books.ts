import { Schema } from "effect";

/** Codes de livres USFM, dans l'ordre canonique protestant (66 livres). */
export const bookCodes = [
  "GEN",
  "EXO",
  "LEV",
  "NUM",
  "DEU",
  "JOS",
  "JDG",
  "RUT",
  "1SA",
  "2SA",
  "1KI",
  "2KI",
  "1CH",
  "2CH",
  "EZR",
  "NEH",
  "EST",
  "JOB",
  "PSA",
  "PRO",
  "ECC",
  "SNG",
  "ISA",
  "JER",
  "LAM",
  "EZK",
  "DAN",
  "HOS",
  "JOL",
  "AMO",
  "OBA",
  "JON",
  "MIC",
  "NAM",
  "HAB",
  "ZEP",
  "HAG",
  "ZEC",
  "MAL",
  "MAT",
  "MRK",
  "LUK",
  "JHN",
  "ACT",
  "ROM",
  "1CO",
  "2CO",
  "GAL",
  "EPH",
  "PHP",
  "COL",
  "1TH",
  "2TH",
  "1TI",
  "2TI",
  "TIT",
  "PHM",
  "HEB",
  "JAS",
  "1PE",
  "2PE",
  "1JN",
  "2JN",
  "3JN",
  "JUD",
  "REV",
] as const;

export const BookCode = Schema.Literals(bookCodes);
export type BookCode = typeof BookCode.Type;

export interface Book {
  readonly code: BookCode;
  readonly order: number;
  /** Nom français usuel (Segond). */
  readonly name: string;
  readonly abbreviations: ReadonlyArray<string>;
  /** Livres d'un seul chapitre : « Jude 3 » désigne le verset 3. */
  readonly singleChapter: boolean;
}

const definitions: ReadonlyArray<
  readonly [BookCode, string, ReadonlyArray<string>, singleChapter?: boolean]
> = [
  ["GEN", "Genèse", ["gn", "ge", "gen"]],
  ["EXO", "Exode", ["ex", "exo"]],
  ["LEV", "Lévitique", ["lv", "le", "lev"]],
  ["NUM", "Nombres", ["nb", "no", "nom"]],
  ["DEU", "Deutéronome", ["dt", "de", "deut"]],
  ["JOS", "Josué", ["jos"]],
  ["JDG", "Juges", ["jg", "jug"]],
  ["RUT", "Ruth", ["rt", "ru"]],
  ["1SA", "1 Samuel", ["1 s", "1 sa", "1 sam"]],
  ["2SA", "2 Samuel", ["2 s", "2 sa", "2 sam"]],
  ["1KI", "1 Rois", ["1 r", "1 ro"]],
  ["2KI", "2 Rois", ["2 r", "2 ro"]],
  ["1CH", "1 Chroniques", ["1 ch", "1 chr"]],
  ["2CH", "2 Chroniques", ["2 ch", "2 chr"]],
  ["EZR", "Esdras", ["esd"]],
  ["NEH", "Néhémie", ["ne", "neh"]],
  ["EST", "Esther", ["est"]],
  ["JOB", "Job", ["jb"]],
  ["PSA", "Psaumes", ["ps", "psaume"]],
  ["PRO", "Proverbes", ["pr", "prov"]],
  ["ECC", "Ecclésiaste", ["ec", "eccl", "qo"]],
  ["SNG", "Cantique des cantiques", ["ct", "cant", "cantique"]],
  ["ISA", "Ésaïe", ["es", "esa", "is"]],
  ["JER", "Jérémie", ["jr", "je", "jer"]],
  ["LAM", "Lamentations", ["lm", "la", "lam"]],
  ["EZK", "Ézéchiel", ["ez", "eze", "ezech"]],
  ["DAN", "Daniel", ["dn", "da", "dan"]],
  ["HOS", "Osée", ["os"]],
  ["JOL", "Joël", ["jl", "joe"]],
  ["AMO", "Amos", ["am"]],
  ["OBA", "Abdias", ["ab", "abd"], true],
  ["JON", "Jonas", ["jon"]],
  ["MIC", "Michée", ["mi", "mic"]],
  ["NAM", "Nahum", ["na", "nah"]],
  ["HAB", "Habakuk", ["ha", "hab"]],
  ["ZEP", "Sophonie", ["so", "soph"]],
  ["HAG", "Aggée", ["ag", "agg"]],
  ["ZEC", "Zacharie", ["za", "zac", "zach"]],
  ["MAL", "Malachie", ["ml", "mal"]],
  ["MAT", "Matthieu", ["mt", "mat", "matt"]],
  ["MRK", "Marc", ["mc", "mr"]],
  ["LUK", "Luc", ["lc", "lu"]],
  ["JHN", "Jean", ["jn"]],
  ["ACT", "Actes", ["ac", "act", "actes des apotres"]],
  ["ROM", "Romains", ["rm", "ro", "rom"]],
  ["1CO", "1 Corinthiens", ["1 co", "1 cor"]],
  ["2CO", "2 Corinthiens", ["2 co", "2 cor"]],
  ["GAL", "Galates", ["ga", "gal"]],
  ["EPH", "Éphésiens", ["ep", "eph"]],
  ["PHP", "Philippiens", ["ph", "phil"]],
  ["COL", "Colossiens", ["col"]],
  ["1TH", "1 Thessaloniciens", ["1 th", "1 thess"]],
  ["2TH", "2 Thessaloniciens", ["2 th", "2 thess"]],
  ["1TI", "1 Timothée", ["1 tm", "1 ti", "1 tim"]],
  ["2TI", "2 Timothée", ["2 tm", "2 ti", "2 tim"]],
  ["TIT", "Tite", ["tt", "tit"]],
  ["PHM", "Philémon", ["phm", "philem"], true],
  ["HEB", "Hébreux", ["he", "heb"]],
  ["JAS", "Jacques", ["jc", "ja", "jac"]],
  ["1PE", "1 Pierre", ["1 p", "1 pi", "1 pe"]],
  ["2PE", "2 Pierre", ["2 p", "2 pi", "2 pe"]],
  ["1JN", "1 Jean", ["1 jn"]],
  ["2JN", "2 Jean", ["2 jn"], true],
  ["3JN", "3 Jean", ["3 jn"], true],
  ["JUD", "Jude", ["jud"], true],
  ["REV", "Apocalypse", ["ap", "apo", "apoc"]],
];

export const books: ReadonlyArray<Book> = definitions.map(
  ([code, name, abbreviations, singleChapter = false], index) => ({
    code,
    order: index + 1,
    name,
    abbreviations,
    singleChapter,
  }),
);

const byCode = new Map(books.map((book) => [book.code, book]));

export const bookByCode = (code: BookCode): Book => byCode.get(code) as Book;

/** Minuscules, sans accents, sans espaces ni ponctuation : « 1 Co. » → « 1co ». */
export const normalizeBookKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const exactKeys = new Map<string, Book>();
for (const book of books) {
  for (const key of [book.name, book.code, ...book.abbreviations]) {
    exactKeys.set(normalizeBookKey(key), book);
  }
}

/** Nom complet, code USFM, abréviation, ou début non ambigu du nom (≥ 3 caractères). */
export const findBook = (input: string): Book | undefined => {
  const key = normalizeBookKey(input);
  if (key === "") return undefined;
  const exact = exactKeys.get(key);
  if (exact !== undefined) return exact;
  if (key.length < 3) return undefined;
  const candidates = books.filter((book) => normalizeBookKey(book.name).startsWith(key));
  return candidates.length === 1 ? candidates[0] : undefined;
};
