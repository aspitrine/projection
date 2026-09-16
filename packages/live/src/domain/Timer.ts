import { type StageTimer, idleTimer } from "@projection/presentation/domain";

export { idleTimer };

/** Nouvelle durée : le minuteur repart de zéro, à l'arrêt. */
export const setDuration = (durationMs: number): StageTimer => ({
  durationMs,
  elapsedMs: 0,
  runningSince: null,
});

export const startTimer = (timer: StageTimer, now: number): StageTimer =>
  timer.runningSince !== null || timer.durationMs === 0 ? timer : { ...timer, runningSince: now };

export const pauseTimer = (timer: StageTimer, now: number): StageTimer =>
  timer.runningSince === null
    ? timer
    : {
        durationMs: timer.durationMs,
        elapsedMs: timer.elapsedMs + Math.max(0, now - timer.runningSince),
        runningSince: null,
      };

/** Remet le compte à rebours à sa durée, à l'arrêt. */
export const resetTimer = (timer: StageTimer): StageTimer => setDuration(timer.durationMs);
