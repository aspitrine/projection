import type { DeckItem, LiveCursor } from "@projection/live/domain";
import { cn } from "@projection/ui/lib/utils";
import type { ReactNode } from "react";

import { contentToSlide, roomTheme } from "@/features/display/frame";
import { SlideRenderer } from "@/features/presentation/slide-renderer";
import { m } from "@/paraglide/messages";

/** Cartes préparées au centre ; le rouge indique exclusivement la diapo à l'antenne. */
export function LiveSlideCards({
  item,
  title,
  live,
  onBroadcast,
  before,
  after,
}: {
  item: DeckItem;
  title: string;
  live: LiveCursor | null;
  onBroadcast: (slideIndex: number) => void;
  before?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <ol
      className="mx-auto grid max-w-6xl grid-cols-2 gap-3 xl:grid-cols-3"
      aria-label={`Paroles : ${title}`}
    >
      {before}
      {item.slides.map((slide, slideIndex) => {
        const onAir = live?.itemId === item.itemId && live.slideIndex === slideIndex;
        const label = slide.label ?? m.live_slide_label({ number: slideIndex + 1 });
        return (
          <li key={slideIndex}>
            <button
              type="button"
              aria-current={onAir ? "true" : undefined}
              aria-label={`Diffuser ${title} — ${label}`}
              onClick={() => onBroadcast(slideIndex)}
              className={cn(
                "relative block w-full overflow-hidden text-left ring-1 ring-foreground/10 transition hover:ring-2 hover:ring-red-400 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none",
                onAir && "ring-2 ring-red-500",
              )}
            >
              <SlideRenderer theme={roomTheme} slide={contentToSlide(slide.content)} />
              <span className="bg-background/90 flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                <span className="truncate font-medium">{label}</span>
                <span className="text-muted-foreground shrink-0">Diffuser</span>
              </span>
            </button>
          </li>
        );
      })}
      {after}
    </ol>
  );
}
