import { OrganizationId, TextSlideId } from "@projection/shared-kernel";
import { Schema } from "effect";

export class TextSlide extends Schema.Class<TextSlide>("TextSlide")({
  id: TextSlideId,
  organizationId: OrganizationId,
  /** Nom dans la bibliothèque (pas forcément affiché sur la diapo). */
  title: Schema.NonEmptyString,
  /** Contenu au format texte enrichi léger (voir `parseRichText`). */
  source: Schema.String,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}) {}

export class TextSlideInput extends Schema.Class<TextSlideInput>("TextSlideInput")({
  title: Schema.String.check(Schema.isTrimmed(), Schema.isNonEmpty()),
  source: Schema.String,
}) {}

export class TextSlideSummary extends Schema.Class<TextSlideSummary>("TextSlideSummary")({
  id: TextSlideId,
  title: Schema.String,
  updatedAt: Schema.Number,
}) {}

export class EmptyTextSlide extends Schema.TaggedError<EmptyTextSlide>()("EmptyTextSlide", {}) {}

export class TextSlideNotFound extends Schema.TaggedError<TextSlideNotFound>()(
  "TextSlideNotFound",
  { id: TextSlideId },
) {}
