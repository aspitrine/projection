import { type VideoPlayback, idleVideo } from "@projection/presentation/domain";

export { idleVideo };

export const playVideo = (playback: VideoPlayback, now: number): VideoPlayback =>
  playback.playing ? playback : { ...playback, playing: true, since: now };

export const pauseVideo = (playback: VideoPlayback, now: number): VideoPlayback =>
  playback.since === null
    ? { ...playback, playing: false }
    : {
        playing: false,
        positionMs: playback.positionMs + Math.max(0, now - playback.since),
        since: null,
      };

/** Revient au début, à l'arrêt. */
export const restartVideo = (): VideoPlayback => idleVideo;
