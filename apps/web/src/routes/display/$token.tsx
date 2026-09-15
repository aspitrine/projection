import { useAtomValue } from "@effect/atom-react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { displayAtom } from "@/features/display/atoms";
import { frameToSlide, themeFor } from "@/features/display/frame";
import { SlideRenderer } from "@/features/presentation/slide-renderer";
import { m } from "@/paraglide/messages";

/** Écran de sortie public : aucune session, accès par token. */
export const Route = createFileRoute("/display/$token")({
  component: () => (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden text-white">
      <ClientOnly fallback={null}>
        <DisplayScreen />
      </ClientOnly>
    </div>
  ),
});

function StatusMessage({ children }: { children: string }) {
  return (
    <p className="max-w-md px-6 text-center text-sm text-white/60" data-testid="display-status">
      {children}
    </p>
  );
}

function DisplayScreen() {
  const { token } = Route.useParams();
  const result = useAtomValue(displayAtom(token));
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  const outputType =
    result._tag === "Success" && result.value._tag === "Frame"
      ? result.value.display.outputType
      : null;

  // Stream : page entièrement transparente pour l'incrustation OBS ; sinon fond noir.
  useEffect(() => {
    const background = outputType === "stream" ? "transparent" : "#000000";
    document.documentElement.style.background = background;
    document.body.style.background = background;
  }, [outputType]);

  if (result._tag === "Initial" || result._tag === "Failure") {
    return <StatusMessage>{m.display_connecting()}</StatusMessage>;
  }
  if (result.value._tag === "InvalidToken") {
    return <StatusMessage>{m.display_invalid_token()}</StatusMessage>;
  }

  const { frame, outputType: type } = result.value.display;

  return (
    <div
      className="w-[min(100vw,calc(100vh*16/9))] cursor-none"
      onDoubleClick={toggleFullscreen}
      data-testid="display-screen"
      data-version={frame.version}
      data-output-type={type}
    >
      <SlideRenderer slide={frameToSlide(frame)} theme={themeFor(type)} />
      {hintVisible && type !== "stream" && (
        <p className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/40">
          {m.display_fullscreen_hint()}
        </p>
      )}
    </div>
  );
}
