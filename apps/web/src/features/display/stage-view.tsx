import type { Branding } from "@projection/outputs/domain";
import { type Frame, remainingMs } from "@projection/presentation/domain";
import { cn } from "@projection/ui/lib/utils";

import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

import { FrameView } from "./frame-view";
import { formatClock, formatDuration, useNow } from "./time";

/** Écran retour scène : diapo courante, diapo suivante, horloge, minuteur et notes. */
export function StageScreen({ frame, branding }: { frame: Frame; branding: Branding }) {
  const now = useNow();
  const stage = frame.stage;
  const remaining = stage === null ? 0 : remainingMs(stage.timer, now);

  return (
    <div
      className="grid h-screen w-screen gap-4 overflow-hidden bg-black p-4 text-white lg:grid-cols-[3fr_1fr]"
      data-testid="stage-screen"
    >
      <div className="flex min-h-0 items-center justify-center overflow-hidden">
        {/* La diapo garde son format 16:9 sans dépasser la hauteur de l'écran. */}
        <div className="w-full max-w-[calc((100vh-2rem)*16/9)]">
          <FrameView
            content={frame.content}
            cover={frame.cover}
            type="stage"
            branding={branding}
            className="ring-1 ring-white/10"
          />
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-4">
        <p className="text-center text-4xl font-semibold tabular-nums" data-testid="stage-clock">
          {formatClock(now, getLocale())}
        </p>

        {stage !== null && stage.timer.durationMs > 0 && (
          <p
            className={cn(
              "text-center text-5xl font-bold tabular-nums",
              remaining < 0 ? "text-red-500" : "text-emerald-400",
            )}
            data-testid="stage-timer"
          >
            {formatDuration(remaining)}
          </p>
        )}

        <section className="space-y-1">
          <h2 className="text-xs text-white/50 uppercase">{m.stage_next()}</h2>
          <FrameView
            content={stage?.next ?? { _tag: "Blank" }}
            cover="none"
            type="stage"
            branding={branding}
            className="opacity-80 ring-1 ring-white/10"
          />
        </section>

        {stage?.notes != null && stage.notes !== "" && (
          <section className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            <h2 className="text-xs text-white/50 uppercase">{m.stage_notes()}</h2>
            <p className="text-lg whitespace-pre-wrap" data-testid="stage-notes">
              {stage.notes}
            </p>
          </section>
        )}
      </aside>
    </div>
  );
}
