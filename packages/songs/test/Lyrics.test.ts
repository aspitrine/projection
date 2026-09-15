import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { formatLyrics, parseLyrics, parseTag } from "../src/domain/Lyrics";

const parse = (text: string) => Effect.runSync(parseLyrics(text));
const parseError = (text: string) => Effect.runSync(Effect.flip(parseLyrics(text)));

describe("parseTag", () => {
  it.each([
    ["Couplet 1", "verse", 1],
    ["couplet", "verse", null],
    ["C2", "verse", 2],
    ["Verse 3", "verse", 3],
    ["Refrain", "chorus", null],
    ["REFRAIN 2", "chorus", 2],
    ["Chorus", "chorus", null],
    ["Pré-refrain", "pre_chorus", null],
    ["pre-chorus", "pre_chorus", null],
    ["Pont", "bridge", null],
    ["Bridge", "bridge", null],
    ["Intro", "intro", null],
    ["Instrumental", "interlude", null],
    ["Fin", "ending", null],
    ["Outro", "ending", null],
    ["Tag", "tag", null],
  ] as const)("« %s » → %s %s", (raw, type, number) => {
    const tag = parseTag(raw);
    expect(tag.type).toBe(type);
    expect(tag.number).toBe(number);
  });

  it("crée une section libre pour une balise inconnue", () => {
    expect(parseTag(" Solo ")).toMatchObject({ type: "other", label: "Solo", number: null });
  });
});

describe("parseLyrics", () => {
  it("lit des sections balisées et l'ordre de passage avec répétitions", () => {
    const lyrics = parse(`
[Couplet 1]
Il est bon de louer le Seigneur
Et de chanter son nom

[Refrain]
Alléluia, alléluia

[Couplet 2]
Tes bienfaits ne peuvent se compter

[Refrain]

[Pont]
Toute ma vie
    `);
    expect(lyrics.sections.map((section) => section.id)).toEqual([
      "verse-1",
      "chorus",
      "verse-2",
      "bridge",
    ]);
    expect(lyrics.arrangement).toEqual(["verse-1", "chorus", "verse-2", "chorus", "bridge"]);
    expect(lyrics.sections[0]?.lines).toEqual([
      "Il est bon de louer le Seigneur",
      "Et de chanter son nom",
    ]);
  });

  it("numérote automatiquement les couplets sans numéro", () => {
    const lyrics = parse("[Couplet]\nA\n[Refrain]\nR\n[Couplet]\nB\n[Couplet 5]\nC\n[Couplet]\nD");
    expect(lyrics.arrangement).toEqual(["verse-1", "chorus", "verse-2", "verse-5", "verse-6"]);
  });

  it("transforme des strophes sans balise en couplets", () => {
    const lyrics = parse("Ligne 1\nLigne 2\n\nLigne 3\n\n\nLigne 4");
    expect(lyrics.arrangement).toEqual(["verse-1", "verse-2", "verse-3"]);
    expect(lyrics.sections[0]?.lines).toEqual(["Ligne 1", "Ligne 2"]);
  });

  it("accepte une section redéfinie avec les mêmes paroles", () => {
    const lyrics = parse("[Refrain]\nR\n[Couplet 1]\nA\n[Refrain]\nR");
    expect(lyrics.sections).toHaveLength(2);
    expect(lyrics.arrangement).toEqual(["chorus", "verse-1", "chorus"]);
  });

  it("gère les fins de ligne Windows et les espaces", () => {
    const lyrics = parse("[Refrain]\r\n   Gloire à Dieu   \r\n");
    expect(lyrics.sections[0]?.lines).toEqual(["Gloire à Dieu"]);
  });

  it("refuse des paroles vides", () => {
    expect(parseError("  \n\n[Refrain]\n")).toMatchObject({
      reason: "UndefinedRepeat",
      tag: "Refrain",
    });
    expect(parseError("   ")).toMatchObject({ _tag: "InvalidLyrics", reason: "Empty", tag: null });
  });

  it("refuse une section redéfinie avec d'autres paroles", () => {
    expect(parseError("[Refrain]\nA\n[Refrain]\nB")).toMatchObject({
      reason: "DuplicateSection",
      tag: "Refrain",
    });
  });

  it("refuse la répétition d'une section jamais définie", () => {
    expect(parseError("[Couplet 1]\nA\n[Pont]")).toMatchObject({
      reason: "UndefinedRepeat",
      tag: "Pont",
    });
    expect(parseError("[Couplet 1]\nA\n[Couplet]")).toMatchObject({ reason: "UndefinedRepeat" });
  });
});

describe("formatLyrics", () => {
  it("écrit chaque section une fois puis ses répétitions en balise seule", () => {
    const text = formatLyrics(parse("[Couplet 1]\nA\n[Refrain]\nR\n[Couplet 2]\nB\n[Refrain]"));
    expect(text).toBe("[Couplet 1]\nA\n\n[Refrain]\nR\n\n[Couplet 2]\nB\n\n[Refrain]");
  });

  const Word = Schema.Literals([
    "Gloire",
    "à",
    "Dieu",
    "Alléluia",
    "Jésus",
    "Saint",
    "amour",
    "paix",
  ]);
  const Line = Schema.Array(Word).check(Schema.isMinLength(1));
  const Kind = Schema.Literals(["verse", "chorus", "pre_chorus", "bridge", "solo"]);
  const Spec = Schema.Array(
    Schema.Struct({
      kind: Kind,
      lines: Schema.Array(Line).check(Schema.isMinLength(1)),
      repeat: Schema.Boolean,
    }),
  ).check(Schema.isMinLength(1));

  const tagFor = {
    verse: "Couplet",
    chorus: "Refrain",
    pre_chorus: "Pré-refrain",
    bridge: "Pont",
    solo: "Solo",
  };

  it.prop("parse(format(parse(texte))) = parse(texte)", { spec: Spec }, ({ spec }) => {
    const defined = new Set<string>();
    const text = spec
      .map(({ kind, lines, repeat }) => {
        const tag = `[${tagFor[kind]}]`;
        if (kind !== "verse" && repeat && defined.has(kind)) return tag;
        if (kind !== "verse" && defined.has(kind)) return null;
        defined.add(kind);
        return [tag, ...lines.map((words) => words.join(" "))].join("\n");
      })
      .filter((part) => part !== null)
      .join("\n\n");

    const first = parse(text);
    const second = parse(formatLyrics(first));
    expect(second.arrangement).toEqual(first.arrangement);
    expect(second.sections).toEqual(first.sections);
  });
});
