import { SlideTheme, defaultTheme } from "@projection/presentation/domain";

import type { OutputType } from "./Output";

/** Salle : plein écran centré, sans libellés (réservés à la régie). */
export const roomTheme = new SlideTheme({ ...defaultTheme, showCaption: false });

/** Retour scène : texte aligné en haut à gauche, libellé de section visible pour les musiciens. */
export const stageTheme = new SlideTheme({
  ...defaultTheme,
  textAlign: "left",
  verticalAlign: "top",
  paddingPercent: 4,
  maxFontSize: 12,
  textShadow: false,
  showCaption: true,
});

/** Stream : lower third sur fond transparent (source navigateur OBS). */
export const streamTheme = new SlideTheme({
  ...defaultTheme,
  background: "transparent",
  verticalAlign: "bottom",
  paddingPercent: 5,
  minFontSize: 2.5,
  maxFontSize: 6,
  showCaption: false,
  textBackground: "rgba(0, 0, 0, 0.6)",
});

/** Thème par défaut d'un type de sortie, et cible du bouton « réinitialiser ». */
export const defaultThemeFor = (type: OutputType): SlideTheme =>
  ({ room: roomTheme, stage: stageTheme, stream: streamTheme })[type];
