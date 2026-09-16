import { describe, expect, it } from "@effect/vitest";
import {
  idleTimer,
  idleVideo,
  remainingMs,
  videoEnded,
  videoPositionMs,
} from "@projection/presentation/domain";

import { pauseTimer, resetTimer, setDuration, startTimer } from "../src/domain/Timer";
import {
  pauseVideo,
  playVideo,
  restartVideo,
  seekVideo,
  withVideoDuration,
} from "../src/domain/Video";
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

describe("Lecture vidéo", () => {
  it("déplace la position, borne par la durée et reprend au bout", () => {
    const withDuration = withVideoDuration(idleVideo, 10_000);
    expect(withDuration.durationMs).toBe(10_000);

    const playing = playVideo(withDuration, 1_000);
    expect(videoPositionMs(playing, 4_000)).toBe(3_000);
    // Au-delà de la fin, la position ne dépasse pas la durée.
    expect(videoPositionMs(playing, 99_000)).toBe(10_000);
    expect(videoEnded(playing, 99_000)).toBe(true);

    // Déplacement en cours de lecture : le compte repart de la nouvelle position.
    const moved = seekVideo(playing, 6_000, 5_000);
    expect(moved).toMatchObject({ playing: true, positionMs: 6_000, since: 5_000 });
    expect(videoPositionMs(moved, 7_000)).toBe(8_000);
    // Déplacement au-delà de la durée : borné.
    expect(seekVideo(playing, 99_000, 5_000).positionMs).toBe(10_000);

    // Pause puis reprise depuis la même position.
    const paused = pauseVideo(moved, 8_000);
    expect(paused).toMatchObject({ playing: false, positionMs: 9_000, since: null });
    expect(playVideo(paused, 20_000)).toMatchObject({ positionMs: 9_000, since: 20_000 });

    // Lecture relancée alors qu'on était au bout : retour au début.
    const atEnd = { ...withDuration, positionMs: 10_000 };
    expect(playVideo(atEnd, 30_000)).toMatchObject({ positionMs: 0, playing: true });

    // Arrêt : début du fichier, durée conservée.
    expect(restartVideo(moved)).toEqual({
      playing: false,
      positionMs: 0,
      since: null,
      durationMs: 10_000,
    });
  });
});
