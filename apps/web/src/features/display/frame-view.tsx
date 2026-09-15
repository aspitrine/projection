import type { Branding, OutputType } from "@projection/outputs/domain";
import { type Cover, type FrameContent, SlideTheme } from "@projection/presentation/domain";
import { cn } from "@projection/ui/lib/utils";

import { SlideRenderer } from "../presentation/slide-renderer";
import { contentToSlide, roomTheme, stageTheme, streamTheme, themeFor } from "./frame";

/** Écran noir : noir franc en salle et au retour, rien du tout sur le stream (transparent). */
const blackThemes = {
  room: new SlideTheme({ ...roomTheme, background: "#000000" }),
  stage: new SlideTheme({ ...stageTheme, background: "#000000" }),
  stream: new SlideTheme({ ...streamTheme, background: "transparent" }),
} as const;

/** Seules les URL http(s) ou relatives sont chargées sur les écrans publics. */
export const safeLogoUrl = (url: string | null) =>
  url !== null && /^(https?:\/\/|\/(?!\/))/.test(url) ? url : null;

/**
 * Image d'une sortie : contenu ou bouton d'urgence actif (noir, logo, texte masqué).
 * Utilisé par les écrans et par les aperçus de la régie.
 */
export function FrameView({
  content,
  cover,
  type,
  branding,
  className,
}: {
  content: FrameContent;
  cover: Cover;
  type: OutputType;
  branding: Branding;
  className?: string;
}) {
  switch (cover) {
    case "black":
      return (
        <SlideRenderer
          className={className}
          theme={blackThemes[type]}
          slide={{ kind: "blank" }}
          data-cover="black"
        />
      );
    case "hideText":
      return (
        <SlideRenderer
          className={className}
          theme={themeFor(type)}
          slide={{ kind: "blank" }}
          data-cover="hideText"
        />
      );
    case "logo":
      return <LogoSlide type={type} branding={branding} className={className} />;
    case "none":
      return (
        <SlideRenderer
          className={className}
          theme={themeFor(type)}
          slide={contentToSlide(content)}
          data-cover="none"
        />
      );
  }
}

function LogoSlide({
  type,
  branding,
  className,
}: {
  type: OutputType;
  branding: Branding;
  className?: string;
}) {
  const theme = themeFor(type);
  const logo = safeLogoUrl(branding.logoUrl);
  const stream = type === "stream";

  return (
    <div
      data-slot="slide"
      data-cover="logo"
      className={cn(
        "relative flex aspect-video w-full overflow-hidden select-none",
        stream ? "items-end justify-end" : "items-center justify-center",
        className,
      )}
      style={{
        background: stream ? "transparent" : "#000000",
        color: theme.color,
        fontFamily: theme.fontFamily,
        fontWeight: theme.fontWeight,
        containerType: "size",
      }}
    >
      <div
        className={cn(
          "flex items-center",
          stream ? "m-[4cqh] gap-[1.5cqh] px-[2cqh] py-[1.5cqh]" : "flex-col gap-[3cqh]",
        )}
        style={stream ? { background: theme.textBackground ?? "rgba(0, 0, 0, 0.6)" } : undefined}
      >
        {logo !== null && (
          <img
            src={logo}
            alt=""
            className={stream ? "h-[6cqh] w-auto" : "max-h-[45cqh] max-w-[60cqw] object-contain"}
          />
        )}
        {(logo === null || stream) && branding.name !== "" && (
          <span data-slot="logo-name" style={{ fontSize: stream ? "4cqh" : "9cqh" }}>
            {branding.name}
          </span>
        )}
      </div>
    </div>
  );
}
