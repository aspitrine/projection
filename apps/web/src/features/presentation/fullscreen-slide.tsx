import { Button } from "@projection/ui/components/button";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { m } from "@/paraglide/messages";

import { type RenderableSlide, SlideRenderer } from "./slide-renderer";

/**
 * Diapo en plein écran (même composant de rendu que les miniatures).
 * Clavier : flèches, Page préc./suiv., Espace, Échap.
 */
export function FullscreenSlide({
  slide,
  onClose,
  onPrevious,
  onNext,
}: {
  slide: RenderableSlide;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) onNext?.();
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) onPrevious?.();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onNext, onPrevious]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={m.slide_fullscreen()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={onClose}
    >
      <div className="w-[min(100vw,calc(100vh*16/9))]" onClick={(event) => event.stopPropagation()}>
        <SlideRenderer slide={slide} data-testid="fullscreen-slide" />
      </div>
      <Button
        ref={closeButton}
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 text-white/70 hover:text-white"
        aria-label={m.slide_close_fullscreen()}
        onClick={onClose}
      >
        <X className="size-5" />
      </Button>
    </div>,
    document.body,
  );
}
