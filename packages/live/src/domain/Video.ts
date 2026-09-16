import { type VideoPlayback, idleVideo, videoPositionMs } from "@projection/presentation/domain";

export { idleVideo };

/** Reprend depuis le début quand la lecture était arrivée au bout. */
export const playVideo = (playback: VideoPlayback, now: number): VideoPlayback => {
  if (playback.playing) return playback;
  const atEnd = playback.durationMs > 0 && playback.positionMs >= playback.durationMs;
  return { ...playback, playing: true, positionMs: atEnd ? 0 : playback.positionMs, since: now };
};

export const pauseVideo = (playback: VideoPlayback, now: number): VideoPlayback =>
  playback.since === null
    ? { ...playback, playing: false }
    : { ...playback, playing: false, positionMs: videoPositionMs(playback, now), since: null };

/** Revient au début, à l'arrêt (la durée connue est conservée). */
export const restartVideo = (playback: VideoPlayback): VideoPlayback => ({
  ...playback,
  playing: false,
  positionMs: 0,
  since: null,
});

/** Déplacement dans la vidéo ; la lecture continue si elle était en cours. */
export const seekVideo = (
  playback: VideoPlayback,
  positionMs: number,
  now: number,
): VideoPlayback => {
  const bounded = Math.max(
    0,
    playback.durationMs > 0 ? Math.min(positionMs, playback.durationMs) : positionMs,
  );
  return { ...playback, positionMs: bounded, since: playback.playing ? now : null };
};

/** Durée signalée par la régie une fois le fichier chargé. */
export const withVideoDuration = (playback: VideoPlayback, durationMs: number): VideoPlayback => ({
  ...playback,
  durationMs: Math.max(0, Math.round(durationMs)),
});
