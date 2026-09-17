import {
  type SlideLayout,
  type SlideTheme,
  defaultTheme,
  fitFontSize,
  layoutTheme,
} from "@projection/presentation/domain";
import type { SlideBackground } from "@projection/outputs/domain";
import type { Block } from "@projection/slides/domain";
import { cn } from "@projection/ui/lib/utils";
import { type ComponentProps, useLayoutEffect, useRef } from "react";

import { RichTextView } from "../slides/rich-text-view";

/** Contenu affichable, quel que soit le type d'élément d'origine. */
export type RenderableSlide =
  | {
      readonly kind: "lines";
      readonly lines: ReadonlyArray<string>;
      readonly caption?: string | null;
      /** Référence (verset) : plus petite que le texte, placée selon `referencePlacement`. */
      readonly reference?: string | null;
    }
  | {
      readonly kind: "rich";
      readonly blocks: ReadonlyArray<Block>;
      readonly layout?: SlideLayout;
      readonly caption?: string | null;
    }
  | {
      readonly kind: "media";
      readonly url: string;
      readonly video: boolean;
      readonly caption?: string | null;
    }
  | { readonly kind: "blank" };

/**
 * Taille exprimée en % de la hauteur d'une diapo 16:9 tenant dans le cadre. Sur un écran
 * d'un autre format (fenêtre en portrait), le texte garde la même taille au lieu de grossir.
 */
export const slideSize = (percent: number) => `min(${percent}cqh, ${(percent * 9) / 16}cqw)`;

/** Marge sous une référence posée en bas de la diapo, en % de la hauteur. */
const BOTTOM_REFERENCE_MARGIN_PERCENT = 1.5;

const justify = { top: "flex-start", center: "center", bottom: "flex-end" } as const;

/**
 * Rendu unique d'une diapo 16:9, utilisé pour les miniatures, les aperçus et les
 * sorties plein écran. Toutes les tailles sont relatives à la hauteur de la diapo
 * (`cqh`) et le texte est réduit automatiquement pour tenir.
 */
export function SlideRenderer({
  slide,
  theme: outputTheme = defaultTheme,
  background = null,
  referencePlacement = "bottom",
  className,
  style,
  ...props
}: ComponentProps<"div"> & {
  slide: RenderableSlide;
  /** `bottom` : tout en bas de la diapo (salle) ; `below` : juste sous le texte (stream). */
  referencePlacement?: "bottom" | "below";
  theme?: SlideTheme;
  /** Fond du thème, déjà résolu en URL ; le voile vient de `theme.backgroundDim`. */
  background?: SlideBackground | null;
}) {
  // La mise en page de la diapo impose son cadrage par-dessus le thème de la sortie.
  const theme =
    slide.kind === "rich" ? layoutTheme(slide.layout ?? "free", outputTheme) : outputTheme;
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const reference = slide.kind === "lines" ? (slide.reference ?? null) : null;

  useLayoutEffect(() => {
    const boxElement = box.current;
    const areaElement = area.current;
    const contentElement = content.current;
    if (boxElement === null || areaElement === null || contentElement === null) return;

    const fit = () => {
      const apply = (size: number) => {
        contentElement.style.fontSize = slideSize(size);
        // La référence posée en bas suit la taille du texte, en plus petit.
        boxElement.style.setProperty("--slide-font-size", slideSize(size));
      };
      const size = fitFontSize({
        min: theme.minFontSize,
        max: theme.maxFontSize,
        fits: (candidate) => {
          apply(candidate);
          return (
            contentElement.scrollHeight <= areaElement.clientHeight + 1 &&
            contentElement.scrollWidth <= areaElement.clientWidth + 1
          );
        },
      });
      apply(size);
    };

    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(boxElement);
    return () => observer.disconnect();
  }, [slide, theme]);

  const caption = slide.kind === "blank" ? null : slide.caption;

  return (
    <div
      data-slot="slide"
      aria-roledescription="diapo"
      className={cn("relative aspect-video w-full overflow-hidden select-none", className)}
      style={{
        background: theme.background,
        color: theme.color,
        fontFamily: theme.fontFamily,
        fontWeight: theme.fontWeight,
        lineHeight: theme.lineHeight,
        containerType: "size",
        ...style,
      }}
      {...props}
    >
      {background !== null && (
        <>
          {background.video ? (
            <video
              src={background.url}
              autoPlay
              loop
              muted
              playsInline
              data-slot="slide-background"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <img
              src={background.url}
              alt=""
              data-slot="slide-background"
              className="absolute inset-0 size-full object-cover"
            />
          )}
          {theme.backgroundDim > 0 && (
            <div
              data-slot="slide-dim"
              className="absolute inset-0"
              style={{ background: `rgb(0 0 0 / ${theme.backgroundDim})` }}
            />
          )}
        </>
      )}
      {slide.kind === "media" &&
        (slide.video ? (
          <video
            src={slide.url}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-contain"
          />
        ) : (
          <img src={slide.url} alt="" className="absolute inset-0 size-full object-contain" />
        ))}
      {slide.kind !== "blank" && slide.kind !== "media" && (
        <div
          ref={box}
          className="absolute flex flex-col"
          style={{
            inset: `${theme.paddingPercent}%`,
            // Référence en bas : quasiment collée au bord de l'écran, sans la marge du thème.
            ...(reference !== null &&
              referencePlacement === "bottom" && { bottom: `${BOTTOM_REFERENCE_MARGIN_PERCENT}%` }),
            textAlign: theme.textAlign,
          }}
        >
          <div
            ref={area}
            className="flex min-h-0 flex-1 flex-col"
            style={{ justifyContent: justify[theme.verticalAlign], textAlign: theme.textAlign }}
          >
            <div
              ref={content}
              data-slot="slide-content"
              style={{
                fontSize: slideSize(theme.maxFontSize),
                textShadow: theme.textShadow ? "0 0.06em 0.25em rgb(0 0 0 / 0.6)" : undefined,
                ...(theme.textBackground !== null && {
                  background: theme.textBackground,
                  padding: "0.35em 0.7em",
                }),
              }}
            >
              {slide.kind === "lines" ? (
                slide.lines.map((line, index) => <p key={index}>{line}</p>)
              ) : slide.kind === "rich" ? (
                <RichTextView blocks={slide.blocks} layout={slide.layout} />
              ) : null}
              {reference !== null && referencePlacement === "below" && (
                <p data-slot="slide-reference" style={{ fontSize: "0.45em", marginTop: "0.3em" }}>
                  {reference}
                </p>
              )}
            </div>
          </div>
          {reference !== null && referencePlacement === "bottom" && (
            <p
              data-slot="slide-reference"
              className="shrink-0"
              style={{
                fontSize: "calc(var(--slide-font-size) * 0.45)",
                marginTop: "0.3em",
                textShadow: theme.textShadow ? "0 0.06em 0.25em rgb(0 0 0 / 0.6)" : undefined,
              }}
            >
              {reference}
            </p>
          )}
        </div>
      )}
      {theme.showCaption && caption && (
        <div
          data-slot="slide-caption"
          className="absolute truncate opacity-50"
          style={{
            left: "2%",
            right: "2%",
            bottom: "1.5%",
            fontSize: slideSize(3),
            fontWeight: 400,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
