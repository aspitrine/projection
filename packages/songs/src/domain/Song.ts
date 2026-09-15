import { OrganizationId, SongId } from "@projection/shared-kernel";
import { Schema } from "effect";

import { SectionId, SongSection } from "./SongSection";

const OptionalText = Schema.NullOr(Schema.String);

export class Song extends Schema.Class<Song>("Song")({
  id: SongId,
  organizationId: OrganizationId,
  title: Schema.NonEmptyString,
  authors: OptionalText,
  copyright: OptionalText,
  ccli: OptionalText,
  sections: Schema.Array(SongSection),
  /** Ordre de passage par défaut (une section peut apparaître plusieurs fois). */
  arrangement: Schema.Array(SectionId),
  /** Horodatages en millisecondes depuis l'epoch. */
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}) {}

/** Saisie d'un chant : les paroles sont au format texte (voir `parseLyrics`). */
export class SongInput extends Schema.Class<SongInput>("SongInput")({
  title: Schema.String.check(Schema.isTrimmed(), Schema.isNonEmpty()),
  authors: OptionalText,
  copyright: OptionalText,
  ccli: OptionalText,
  lyrics: Schema.String,
}) {}

export class SongSummary extends Schema.Class<SongSummary>("SongSummary")({
  id: SongId,
  title: Schema.String,
  authors: OptionalText,
  updatedAt: Schema.Number,
}) {}

/** Champ texte facultatif : chaîne vide ou espaces → `null`. */
export const optionalText = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};
