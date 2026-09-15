import {
  type Frame,
  type FrameContent,
  SlideTheme,
  defaultTheme,
} from "@projection/presentation/domain";
import { parseRichText } from "@projection/slides/domain";

import type { RenderableSlide } from "../presentation/slide-renderer";

/** Les écrans de salle n'affichent pas les libellés (réservés à la régie). */
export const roomTheme = new SlideTheme({ ...defaultTheme, showCaption: false });

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
