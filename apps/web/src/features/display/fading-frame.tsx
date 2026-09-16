import type { Branding, OutputType, SlideBackground } from "@projection/outputs/domain";
import { type Frame, SlideTheme } from "@projection/presentation/domain";
import { useEffect, useRef, useState } from "react";

import { FrameView } from "./frame-view";

/**
 * Identité visuelle d'une image : change quand le contenu ou le bouton d'urgence change,
 * mais pas quand la lecture vidéo avance (sinon la vidéo repartirait de zéro).
 */
const contentKey = (frame: Frame) => {
  const { content } = frame;
  const body =
    content._tag === "Lines"
      ? content.lines.join("\n")
      : content._tag === "Rich"
        ? `${content.layout}|${content.source}`
        : content._tag === "Image" || content._tag === "Video"
          ? content.url
          : "";
  return `${frame.cover}|${content._tag}|${body}`;
};

/** Enchaîne les images par fondu croisé, selon la durée du thème (0 : changement net). */
export function FadingFrame({
  frame,
  type,
  branding,
  theme,
  background = null,
  sound,
}: {
  frame: Frame;
  type: OutputType;
  branding: Branding;
  theme: SlideTheme;
  /** Fond du thème : rendu une fois sous les images, pour qu'une vidéo ne reparte pas à zéro. */
  background?: SlideBackground | null;
  sound?: boolean;
}) {
  const [previous, setPrevious] = useState<Frame | null>(null);
  const shownKey = useRef(contentKey(frame));

  useEffect(() => {
    const key = contentKey(frame);
    if (key === shownKey.current) return;
    const outgoing = shownKey.current;
    shownKey.current = key;
    if (theme.transitionMs === 0) return;

    setPrevious((current) => current ?? null);
    const timer = setTimeout(() => setPrevious(null), theme.transitionMs);
    return () => {
      clearTimeout(timer);
      // Deux changements rapprochés : l'ancienne image ne reste pas coincée.
      if (outgoing !== shownKey.current) setPrevious(null);
    };
  }, [frame, theme.transitionMs]);

  // L'écran noir masque tout, fond compris ; les autres couvertures le laissent voir.
  const media = frame.cover === "black" ? null : background;
  // Le fond étant derrière, les images se dessinent par-dessus sans couleur opaque.
  const layerTheme =
    media === null ? theme : new SlideTheme({ ...theme, background: "transparent" });

  return (
    <div className="relative size-full">
      {media !== null && (
        // Dans le flux : le fond donne sa hauteur au bloc, les images se posent par-dessus.
        <div className="relative aspect-video w-full overflow-hidden" aria-hidden>
          {media.video ? (
            <video
              src={media.url}
              autoPlay
              loop
              muted
              playsInline
              data-slot="slide-background"
              className="size-full object-cover"
            />
          ) : (
            <img
              src={media.url}
              alt=""
              data-slot="slide-background"
              className="size-full object-cover"
            />
          )}
          {theme.backgroundDim > 0 && (
            <div
              data-slot="slide-dim"
              className="absolute inset-0"
              style={{ background: `rgb(0 0 0 / ${theme.backgroundDim})` }}
            />
          )}
        </div>
      )}
      {previous !== null && (
        <div className="absolute inset-0" aria-hidden>
          <FrameView
            content={previous.content}
            cover={previous.cover}
            type={type}
            branding={branding}
            theme={layerTheme}
          />
        </div>
      )}
      <div
        key={contentKey(frame)}
        className="absolute inset-0"
        style={
          theme.transitionMs === 0
            ? undefined
            : { animation: `projection-fade ${theme.transitionMs}ms ease-out` }
        }
      >
        <FrameView
          content={frame.content}
          cover={frame.cover}
          type={type}
          branding={branding}
          theme={layerTheme}
          sound={sound}
        />
      </div>
    </div>
  );
}
