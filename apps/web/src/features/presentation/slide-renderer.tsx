import { type SlideTheme, defaultTheme, fitFontSize } from "@projection/presentation/domain";
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
    }
  | {
      readonly kind: "rich";
      readonly blocks: ReadonlyArray<Block>;
      readonly caption?: string | null;
    }
  | { readonly kind: "blank" };

const justify = { top: "flex-start", center: "center", bottom: "flex-end" } as const;

/**
 * Rendu unique d'une diapo 16:9, utilisé pour les miniatures, les aperçus et les
 * sorties plein écran. Toutes les tailles sont relatives à la hauteur de la diapo
 * (`cqh`) et le texte est réduit automatiquement pour tenir.
 */
export function SlideRenderer({
  slide,
  theme = defaultTheme,
  className,
  style,
  ...props
}: ComponentProps<"div"> & { slide: RenderableSlide; theme?: SlideTheme }) {
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const boxElement = box.current;
    const contentElement = content.current;
    if (boxElement === null || contentElement === null) return;

    const fit = () => {
      const apply = (size: number) => {
        contentElement.style.fontSize = `${size}cqh`;
      };
      const size = fitFontSize({
        min: theme.minFontSize,
        max: theme.maxFontSize,
        fits: (candidate) => {
          apply(candidate);
          return (
            contentElement.scrollHeight <= boxElement.clientHeight + 1 &&
            contentElement.scrollWidth <= boxElement.clientWidth + 1
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
      {slide.kind !== "blank" && (
        <div
          ref={box}
          className="absolute flex flex-col"
          style={{
            inset: `${theme.paddingPercent}%`,
            justifyContent: justify[theme.verticalAlign],
            textAlign: theme.textAlign,
          }}
        >
          <div
            ref={content}
            data-slot="slide-content"
            style={{
              fontSize: `${theme.maxFontSize}cqh`,
              textShadow: theme.textShadow ? "0 0.06em 0.25em rgb(0 0 0 / 0.6)" : undefined,
              ...(theme.textBackground !== null && {
                background: theme.textBackground,
                padding: "0.35em 0.7em",
              }),
            }}
          >
            {slide.kind === "lines" ? (
              slide.lines.map((line, index) => <p key={index}>{line}</p>)
            ) : (
              <RichTextView blocks={slide.blocks} />
            )}
          </div>
        </div>
      )}
      {theme.showCaption && caption && (
        <div
          data-slot="slide-caption"
          className="absolute truncate opacity-50"
          style={{ left: "2%", right: "2%", bottom: "1.5%", fontSize: "3cqh", fontWeight: 400 }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
