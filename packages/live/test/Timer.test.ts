import { describe, expect, it } from "@effect/vitest";
import { idleTimer, remainingMs } from "@projection/presentation/domain";

import { pauseTimer, resetTimer, setDuration, startTimer } from "../src/domain/Timer";
import { stageInfoAt } from "../src/domain/Navigation";
import { LiveCursor } from "../src/domain/LiveSession";
import { deckOf, item, itemId } from "./support";

describe("Minuteur du retour scène", () => {
  it("compte à rebours : démarrage, pause, reprise, remise à zéro", () => {
    const set = setDuration(60_000);
    expect(remainingMs(set, 1_000)).toBe(60_000);

    const running = startTimer(set, 1_000);
    expect(remainingMs(running, 11_000)).toBe(50_000);
    // Démarrer deux fois ne change rien.
    expect(startTimer(running, 5_000)).toEqual(running);

    const paused = pauseTimer(running, 11_000);
    expect(paused.runningSince).toBeNull();
    expect(remainingMs(paused, 999_000)).toBe(50_000);

    const resumed = startTimer(paused, 20_000);
    expect(remainingMs(resumed, 30_000)).toBe(40_000);
    // Au-delà de la durée, le temps restant devient négatif.
    expect(remainingMs(resumed, 80_000)).toBe(-10_000);

    expect(resetTimer(resumed)).toEqual(set);
    expect(startTimer(idleTimer, 1_000)).toEqual(idleTimer);
  });
});

describe("stageInfoAt", () => {
  const deck = deckOf([item(1, ["A1", "A2"]), item(3, ["C1"])]);

  it("donne la diapo suivante, les notes de l'élément et le minuteur", () => {
    const info = stageInfoAt(deck, new LiveCursor({ itemId: itemId(1), slideIndex: 0 }), idleTimer);
    expect(info.next).toEqual({ _tag: "Lines", lines: ["A2"], caption: null });
    expect(info.notes).toBeNull();
    expect(info.timer).toEqual(idleTimer);
  });

  it("n'annonce rien après la dernière diapo, ni sans projet", () => {
    const last = stageInfoAt(deck, new LiveCursor({ itemId: itemId(3), slideIndex: 0 }), idleTimer);
    expect(last.next).toEqual({ _tag: "Blank" });
    expect(stageInfoAt(null, null, idleTimer).next).toEqual({ _tag: "Blank" });
  });
});
