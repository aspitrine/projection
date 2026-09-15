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

/**
 * Boutons d'urgence d'une piste : contenu normal, écran noir, logo de l'organisation,
 * ou texte masqué (fond conservé).
 */
export const Cover = Schema.Literals(["none", "black", "logo", "hideText"]);
export type Cover = typeof Cover.Type;

/** Image courante diffusée aux sorties d'une organisation. */
export class Frame extends Schema.Class<Frame>("Frame")({
  version: Schema.Int,
  /** Bouton d'urgence actif : le contenu est conservé mais masqué. */
  cover: Cover,
  content: FrameContent,
  updatedAt: Schema.Number,
}) {}

export const initialFrame = new Frame({
  version: 0,
  cover: "none",
  content: { _tag: "Blank" },
  updatedAt: 0,
});

/** Piste de diffusion : la salle alimente salle et retour, le stream a sa propre piste. */
export const Track = Schema.Literals(["room", "stream"]);
export type Track = typeof Track.Type;
