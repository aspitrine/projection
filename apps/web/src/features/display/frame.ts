export { defaultThemeFor, roomTheme, stageTheme, streamTheme } from "@projection/outputs/domain";
import type { FrameContent } from "@projection/presentation/domain";
import { parseRichText } from "@projection/slides/domain";

import type { RenderableSlide } from "../presentation/slide-renderer";

export const contentToSlide = (content: FrameContent): RenderableSlide => {
  switch (content._tag) {
    case "Lines":
      return { kind: "lines", lines: content.lines, caption: content.caption };
    case "Rich":
      return {
        kind: "rich",
        blocks: parseRichText(content.source),
        layout: content.layout,
        caption: content.caption,
      };
    case "Image":
      return { kind: "media", url: content.url, video: false, caption: content.caption };
    case "Video":
      return { kind: "media", url: content.url, video: true, caption: content.caption };
    case "Blank":
      return { kind: "blank" };
  }
};
