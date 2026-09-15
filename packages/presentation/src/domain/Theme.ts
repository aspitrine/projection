import { Schema } from "effect";

/**
 * Apparence d'une diapo. Les tailles de police sont exprimées en pourcentage de la
 * hauteur de la diapo (unité CSS `cqh`) : le rendu est identique quelle que soit sa taille.
 * Personnalisable par sortie en T2.5.
 */
export class SlideTheme extends Schema.Class<SlideTheme>("SlideTheme")({
  background: Schema.String,
  color: Schema.String,
  fontFamily: Schema.String,
  fontWeight: Schema.Int,
  lineHeight: Schema.Number,
  textAlign: Schema.Literals(["left", "center", "right"]),
  verticalAlign: Schema.Literals(["top", "center", "bottom"]),
  /** Marge intérieure, en % de chaque dimension. */
  paddingPercent: Schema.Number,
  /** Bornes de l'ajustement automatique de la taille du texte (% de la hauteur). */
  minFontSize: Schema.Number,
  maxFontSize: Schema.Number,
  textShadow: Schema.Boolean,
  /** Affiche le libellé (section, référence) en bas de la diapo. */
  showCaption: Schema.Boolean,
}) {}

export const defaultTheme = new SlideTheme({
  background: "#000000",
  color: "#ffffff",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.25,
  textAlign: "center",
  verticalAlign: "center",
  paddingPercent: 6,
  minFontSize: 3,
  maxFontSize: 11,
  textShadow: true,
  showCaption: true,
});
