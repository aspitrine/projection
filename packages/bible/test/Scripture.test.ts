import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { books, findBook, normalizeBookKey } from "../src/domain/Books";
import { formatReference, parseReference } from "../src/domain/Scripture";

const parse = (input: string) => Effect.runSync(parseReference(input));
const parseError = (input: string) => Effect.runSync(Effect.flip(parseReference(input)));

describe("findBook", () => {
  it("contient les 66 livres avec des clés sans ambiguïté", () => {
    expect(books).toHaveLength(66);
    const keys = books.flatMap((book) =>
      [book.name, book.code, ...book.abbreviations].map((key) => [
        normalizeBookKey(key),
        book.code,
      ]),
    );
    const owners = new Map<string, Set<string>>();
    for (const [key, code] of keys) {
      owners.set(key ?? "", (owners.get(key ?? "") ?? new Set()).add(code ?? ""));
    }
    const ambiguous = [...owners].filter(([, codes]) => codes.size > 1);
    expect(ambiguous).toEqual([]);
  });

  it.each([
    ["Jean", "JHN"],
    ["jn", "JHN"],
    ["1 Jean", "1JN"],
    ["1jn", "1JN"],
    ["Genèse", "GEN"],
    ["genese", "GEN"],
    ["Gn", "GEN"],
    ["1 Co", "1CO"],
    ["1Co.", "1CO"],
    ["Ésaïe", "ISA"],
    ["Es", "ISA"],
    ["Esther", "EST"],
    ["Psaumes", "PSA"],
    ["Ps", "PSA"],
    ["apoc", "REV"],
    ["Philémon", "PHM"],
    ["Ph", "PHP"],
    ["Cantique des cantiques", "SNG"],
    ["deuter", "DEU"],
  ])("« %s » → %s", (input, code) => {
    expect(findBook(input)?.code).toBe(code);
  });

  it("refuse un préfixe ambigu ou inconnu", () => {
    expect(findBook("Jo")).toBeUndefined();
    expect(findBook("Hébr")?.code).toBe("HEB");
    expect(findBook("Livre de Mormon")).toBeUndefined();
  });
});

describe("parseReference", () => {
  it.each([
    ["Jean 3.16", "JHN", [3, 16], [3, 16]],
    ["jn 3:16", "JHN", [3, 16], [3, 16]],
    ["Jean 3,16", "JHN", [3, 16], [3, 16]],
    ["Jean 3.16-18", "JHN", [3, 16], [3, 18]],
    ["Jean 3.16 – 18", "JHN", [3, 16], [3, 18]],
    ["Jean 3.16-4.2", "JHN", [3, 16], [4, 2]],
    ["Jean 3", "JHN", [3, null], [3, null]],
    ["Jean 3-4", "JHN", [3, null], [4, null]],
    ["1 Co 13", "1CO", [13, null], [13, null]],
    ["1Co 13:4-7", "1CO", [13, 4], [13, 7]],
    ["Ps 23", "PSA", [23, null], [23, null]],
    ["Jude 3", "JUD", [1, 3], [1, 3]],
    ["Jude 3-5", "JUD", [1, 3], [1, 5]],
    ["Jude 1.24", "JUD", [1, 24], [1, 24]],
  ] as const)("« %s »", (input, book, [startChapter, startVerse], [endChapter, endVerse]) => {
    const reference = parse(input);
    expect(reference.book).toBe(book);
    expect([reference.start.chapter, reference.start.verse]).toEqual([startChapter, startVerse]);
    expect([reference.end.chapter, reference.end.verse]).toEqual([endChapter, endVerse]);
  });

  it.each([
    ["", "Empty"],
    ["   ", "Empty"],
    ["Jean", "Malformed"],
    ["Mormon 3.4", "UnknownBook"],
    ["Jean 3.18-16", "InvalidRange"],
    ["Jean 4-3", "InvalidRange"],
    ["Jean 0", "InvalidRange"],
    ["Jean 3-4.2", "Malformed"],
  ] as const)("refuse « %s » (%s)", (input, reason) => {
    expect(parseError(input)).toMatchObject({ _tag: "InvalidReference", reason });
  });
});

describe("formatReference", () => {
  it.each([
    ["jn 3:16", "Jean 3.16"],
    ["jn 3:16-18", "Jean 3.16-18"],
    ["jn 3:16-4:2", "Jean 3.16-4.2"],
    ["jn 3", "Jean 3"],
    ["jn 3-4", "Jean 3-4"],
    ["1co 13:4-7", "1 Corinthiens 13.4-7"],
    ["jude 3-5", "Jude 3-5"],
  ])("« %s » → « %s »", (input, expected) => {
    expect(formatReference(parse(input))).toBe(expected);
  });

  it("est stable : formatReference(parse(formatReference(r))) = formatReference(r)", () => {
    for (const input of ["Jean 3.16-4.2", "Ps 23", "Jude 3", "2 Tm 3.16", "Ap 21-22"]) {
      const formatted = formatReference(parse(input));
      expect(formatReference(parse(formatted))).toBe(formatted);
    }
  });
});
