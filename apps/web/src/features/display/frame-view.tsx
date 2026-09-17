import type { Branding, OutputType } from "@projection/outputs/domain";
import {
  type Cover,
  type FrameContent,
  SlideTheme,
  videoPositionMs,
} from "@projection/presentation/domain";
import { cn } from "@projection/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

import { m } from "../../paraglide/messages";

import { SlideRenderer, slideSize } from "../presentation/slide-renderer";
import { defaultThemeFor } from "@projection/outputs/domain";

import { contentToSlide } from "./frame";

/** Écran noir : noir franc en salle et au retour, rien du tout sur le stream (transparent). */
const blackTheme = (theme: SlideTheme, type: OutputType) =>
  new SlideTheme({ ...theme, background: type === "stream" ? "transparent" : "#000000" });

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
  sound = false,
  theme = defaultThemeFor(type),
}: {
  content: FrameContent;
  cover: Cover;
  type: OutputType;
  branding: Branding;
  className?: string;
  /** Thème de la sortie ; par défaut celui de son type. */
  theme?: SlideTheme;
  /** Vrai sur les écrans qui doivent restituer le son des vidéos. */
  sound?: boolean;
}) {
  switch (cover) {
    case "black":
      return (
        <SlideRenderer
          className={className}
          theme={blackTheme(theme, type)}
          slide={{ kind: "blank" }}
          data-cover="black"
        />
      );
    case "hideText":
      return (
        <SlideRenderer
          className={className}
          theme={theme}
          slide={{ kind: "blank" }}
          data-cover="hideText"
        />
      );
    case "logo":
      return <LogoSlide type={type} branding={branding} theme={theme} className={className} />;
    case "none":
      if (content._tag === "Video") {
        return <VideoSlide content={content} sound={sound} className={className} />;
      }
      return (
        <SlideRenderer
          className={className}
          theme={theme}
          slide={contentToSlide(content)}
          referencePlacement={type === "stream" ? "below" : "bottom"}
          data-cover="none"
        />
      );
  }
}

function LogoSlide({
  type,
  branding,
  theme,
  className,
}: {
  type: OutputType;
  branding: Branding;
  theme: SlideTheme;
  className?: string;
}) {
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
          <span data-slot="logo-name" style={{ fontSize: slideSize(stream ? 4 : 9) }}>
            {branding.name}
          </span>
        )}
      </div>
    </div>
  );
}

/** Vidéo pilotée par la régie : chaque écran se cale sur la position diffusée. */
function VideoSlide({
  content,
  sound,
  className,
}: {
  content: Extract<FrameContent, { _tag: "Video" }>;
  sound: boolean;
  className?: string;
}) {
  const element = useRef<HTMLVideoElement>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);

  useEffect(() => {
    const video = element.current;
    if (video === null) return;

    const expected = videoPositionMs(content.playback, Date.now()) / 1000;
    // On ne recale que si l'écart est audible : sinon la lecture saccade.
    if (Math.abs(video.currentTime - expected) > 0.5) video.currentTime = expected;

    if (!content.playback.playing) {
      video.pause();
      return;
    }
    video.muted = !sound;
    video.play().catch(() => {
      // Lecture avec son refusée tant que la page n'a pas reçu de clic.
      video.muted = true;
      setSoundBlocked(sound);
      void video.play().catch(() => undefined);
    });
  }, [content.url, content.playback, sound]);

  return (
    <div
      data-slot="slide"
      data-cover="none"
      className={cn("relative aspect-video w-full overflow-hidden bg-black", className)}
      onClick={() => {
        const video = element.current;
        if (video === null || !soundBlocked) return;
        video.muted = false;
        setSoundBlocked(false);
      }}
    >
      <video
        ref={element}
        src={content.url}
        playsInline
        preload="auto"
        className="absolute inset-0 size-full object-contain"
      />
      {soundBlocked && (
        <p className="absolute right-2 bottom-2 bg-black/70 px-2 py-1 text-xs text-white">
          {m.display_sound_blocked()}
        </p>
      )}
    </div>
  );
}
