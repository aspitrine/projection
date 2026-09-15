import type { OutputType } from "@projection/outputs/domain";
import {
  type Frame,
  type FrameContent,
  SlideTheme,
  defaultTheme,
} from "@projection/presentation/domain";
import { parseRichText } from "@projection/slides/domain";

import type { RenderableSlide } from "../presentation/slide-renderer";

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

/** Thème par défaut de chaque type de sortie (personnalisable en T2.5). */
export const themeFor = (type: OutputType): SlideTheme =>
  ({ room: roomTheme, stage: stageTheme, stream: streamTheme })[type];

export const contentToSlide = (content: FrameContent): RenderableSlide => {
  switch (content._tag) {
    case "Lines":
      return { kind: "lines", lines: content.lines, caption: content.caption };
    case "Rich":
      return { kind: "rich", blocks: parseRichText(content.source), caption: content.caption };
    case "Blank":
      return { kind: "blank" };
  }
};

export const frameToSlide = (frame: Frame): RenderableSlide =>
  frame.blackout ? { kind: "blank" } : contentToSlide(frame.content);
