import type { Branding, OutputType } from "@projection/outputs/domain";
import type { Frame, SlideTheme } from "@projection/presentation/domain";
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
  sound,
}: {
  frame: Frame;
  type: OutputType;
  branding: Branding;
  theme: SlideTheme;
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

  return (
    <div className="relative size-full">
      {previous !== null && (
        <div className="absolute inset-0" aria-hidden>
          <FrameView
            content={previous.content}
            cover={previous.cover}
            type={type}
            branding={branding}
            theme={theme}
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
          theme={theme}
          sound={sound}
        />
      </div>
    </div>
  );
}
