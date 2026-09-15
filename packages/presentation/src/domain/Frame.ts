import { Schema } from "effect";

/** Contenu prêt à afficher sur un écran, indépendant du type d'élément d'origine. */
export const FrameContent = Schema.Union([
  Schema.TaggedStruct("Lines", {
    lines: Schema.Array(Schema.String),
    caption: Schema.NullOr(Schema.String),
  }),
  /** Texte enrichi léger (source), analysé par l'écran. */
  Schema.TaggedStruct("Rich", {
    source: Schema.String,
    caption: Schema.NullOr(Schema.String),
  }),
  Schema.TaggedStruct("Blank", {}),
]);
export type FrameContent = typeof FrameContent.Type;

/** Image courante diffusée aux sorties d'une organisation. */
export class Frame extends Schema.Class<Frame>("Frame")({
  version: Schema.Int,
  /** Écran noir : le contenu est conservé mais masqué. */
  blackout: Schema.Boolean,
  content: FrameContent,
  updatedAt: Schema.Number,
}) {}

export const initialFrame = new Frame({
  version: 0,
  blackout: false,
  content: { _tag: "Blank" },
  updatedAt: 0,
});
