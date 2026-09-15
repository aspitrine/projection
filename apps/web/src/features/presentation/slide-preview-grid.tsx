import type { Slide } from "@projection/presentation/domain";

/** Aperçu miniature des diapos (en attendant le rendu thématisé de T1.6). */
export function SlidePreviewGrid({ slides }: { slides: ReadonlyArray<Slide> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {slides.map((slide) => (
        <figure
          key={slide.index}
          data-testid="slide-preview"
          className="flex aspect-video flex-col bg-black p-3 text-white ring-1 ring-foreground/10"
        >
          <figcaption className="text-[0.65rem] text-white/50">
            {slide.label}
            {slide.parts > 1 ? ` · ${slide.part}/${slide.parts}` : ""}
          </figcaption>
          <div className="flex flex-1 flex-col items-center justify-center overflow-hidden text-center text-xs leading-snug">
            {slide.lines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </figure>
      ))}
    </div>
  );
}
