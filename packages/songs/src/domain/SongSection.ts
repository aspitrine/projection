import { Schema } from "effect";

export const SectionType = Schema.Literals([
  "verse",
  "pre_chorus",
  "chorus",
  "bridge",
  "intro",
  "interlude",
  "ending",
  "tag",
  "other",
]);
export type SectionType = typeof SectionType.Type;

/** Identifiant déterministe d'une section dans un chant : `verse-2`, `chorus`, `other-solo`. */
export const SectionId = Schema.NonEmptyString.pipe(Schema.brand("SectionId"));
export type SectionId = typeof SectionId.Type;

export class SongSection extends Schema.Class<SongSection>("SongSection")({
  id: SectionId,
  type: SectionType,
  /** Numéro explicite ou attribué (couplets). `null` pour une section unique. */
  number: Schema.NullOr(Schema.Int),
  /** Libellé libre pour le type `other` (ex. « Solo »). */
  label: Schema.NullOr(Schema.String),
  lines: Schema.Array(Schema.String),
}) {}

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const sectionId = (type: SectionType, number: number | null, label: string | null) =>
  SectionId.make(
    type === "other"
      ? `other-${slug(label ?? "") || "section"}${number === null ? "" : `-${number}`}`
      : number === null
        ? type
        : `${type}-${number}`,
  );
