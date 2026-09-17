import { SlideTheme, defaultTheme } from "@projection/presentation/domain";

import type { OutputType } from "./Output";

/** Salle : plein écran centré, sans libellés (réservés à la régie). */
export const roomTheme = new SlideTheme({ ...defaultTheme, showCaption: false });

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
  ({ room: roomTheme, stream: streamTheme })[type];
