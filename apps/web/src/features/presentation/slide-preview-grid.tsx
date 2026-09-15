import type { Slide } from "@projection/presentation/domain";
import { useState } from "react";

import { m } from "@/paraglide/messages";

import { FullscreenSlide } from "./fullscreen-slide";
import { type RenderableSlide, SlideRenderer } from "./slide-renderer";

const toRenderable = (slide: Slide): RenderableSlide => ({
  kind: "lines",
  lines: slide.lines,
  caption: slide.parts > 1 ? `${slide.label ?? ""} · ${slide.part}/${slide.parts}` : slide.label,
});

/** Miniatures cliquables ; ouverture en plein écran avec navigation au clavier. */
export function SlidePreviewGrid({ slides }: { slides: ReadonlyArray<Slide> }) {
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? undefined : slides[open];

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {slides.map((slide) => (
          <button
            key={slide.index}
            type="button"
            data-testid="slide-preview"
            aria-label={`${m.slide_open_fullscreen()} : ${slide.label ?? slide.index + 1}`}
            className="focus-visible:ring-ring block w-full ring-1 ring-foreground/10 transition hover:ring-foreground/40 focus-visible:ring-2 focus-visible:outline-none"
            onClick={() => setOpen(slide.index)}
          >
            <SlideRenderer slide={toRenderable(slide)} />
          </button>
        ))}
      </div>
      {current !== undefined && open !== null && (
        <FullscreenSlide
          slide={toRenderable(current)}
          onClose={() => setOpen(null)}
          onPrevious={() => setOpen(Math.max(0, open - 1))}
          onNext={() => setOpen(Math.min(slides.length - 1, open + 1))}
        />
      )}
    </>
  );
}
