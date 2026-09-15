import { Schema } from "effect";

/**
 * État d'une session live. Version minimale du spike T0.2 : sera enrichie
 * (projet, élément, pistes Salle/Stream) en T1.8.
 */
export class LiveState extends Schema.Class<LiveState>("LiveState")({
  version: Schema.Int,
  slideIndex: Schema.Int,
  blackout: Schema.Boolean,
  /** Horodatage serveur (ms) de la dernière modification. */
  updatedAt: Schema.Number,
}) {}

export const initialLiveState = new LiveState({
  version: 0,
  slideIndex: 0,
  blackout: false,
  updatedAt: 0,
});

export const goTo = (state: LiveState, slideIndex: number, now: number) =>
  new LiveState({
    ...state,
    version: state.version + 1,
    slideIndex: Math.max(0, slideIndex),
    updatedAt: now,
  });

export const toggleBlackout = (state: LiveState, now: number) =>
  new LiveState({
    ...state,
    version: state.version + 1,
    blackout: !state.blackout,
    updatedAt: now,
  });
