import { useAtomValue } from "@effect/atom-react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { displayAtom } from "@/features/display/atoms";
import { FadingFrame } from "@/features/display/fading-frame";
import { StageScreen } from "@/features/display/stage-view";
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

  const { frame, outputType: type, branding, theme, background } = result.value.display;

  return (
    <div
      // L'image occupe tout l'écran, quel que soit son format : rien n'est rendu en dehors.
      className={type === "stage" ? "h-screen w-screen" : "h-screen w-screen cursor-none"}
      onDoubleClick={toggleFullscreen}
      data-testid="display-screen"
      data-version={frame.version}
      data-output-type={type}
      data-cover={frame.cover}
    >
      {type === "stage" ? (
        <StageScreen frame={frame} branding={branding} theme={theme} />
      ) : (
        <FadingFrame
          frame={frame}
          type={type}
          branding={branding}
          theme={theme}
          background={background}
          sound
          fill
        />
      )}
      {hintVisible && type === "room" && (
        <p className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/40">
          {m.display_fullscreen_hint()}
        </p>
      )}
    </div>
  );
}
