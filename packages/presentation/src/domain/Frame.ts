import { Schema } from "effect";

import { SlideLayout } from "./Layout";

/** Lecture d'une vidéo, pilotée depuis la régie et suivie par tous les écrans. */
export const VideoPlayback = Schema.Struct({
  playing: Schema.Boolean,
  /** Position atteinte lors de la dernière pause. */
  positionMs: Schema.Int,
  /** Heure serveur du début de la lecture en cours, ou `null` à l'arrêt. */
  since: Schema.NullOr(Schema.Number),
  /** Durée du fichier, signalée par la régie ; 0 tant qu'elle est inconnue. */
  durationMs: Schema.Int,
});
export type VideoPlayback = typeof VideoPlayback.Type;

export const idleVideo: VideoPlayback = {
  playing: false,
  positionMs: 0,
  since: null,
  durationMs: 0,
};

/** Position attendue à l'instant `now` (les écrans s'y recalent), bornée par la durée connue. */
export const videoPositionMs = (playback: VideoPlayback, now: number) => {
  const elapsed =
    playback.positionMs + (playback.since === null ? 0 : Math.max(0, now - playback.since));
  return playback.durationMs > 0 ? Math.min(elapsed, playback.durationMs) : elapsed;
};

/** Vrai quand la lecture a atteint la fin du fichier (durée connue). */
export const videoEnded = (playback: VideoPlayback, now: number) =>
  playback.durationMs > 0 && videoPositionMs(playback, now) >= playback.durationMs;

/** Contenu prêt à afficher sur un écran, indépendant du type d'élément d'origine. */
export const FrameContent = Schema.Union([
  Schema.TaggedStruct("Lines", {
    lines: Schema.Array(Schema.String),
    caption: Schema.NullOr(Schema.String),
    /** Référence biblique affichée sur tous les écrans, en plus petit que le texte. */
    reference: Schema.optionalKey(Schema.String),
  }),
  /** Texte enrichi léger (source), analysé par l'écran. */
  Schema.TaggedStruct("Rich", {
    source: Schema.String,
    layout: SlideLayout,
    caption: Schema.NullOr(Schema.String),
  }),
  /** Image de la médiathèque, servie par URL signée. */
  Schema.TaggedStruct("Image", {
    url: Schema.String,
    caption: Schema.NullOr(Schema.String),
  }),
  /** Vidéo de la médiathèque : la lecture est pilotée depuis la régie. */
  Schema.TaggedStruct("Video", {
    url: Schema.String,
    caption: Schema.NullOr(Schema.String),
    playback: VideoPlayback,
  }),
  Schema.TaggedStruct("Blank", {}),
]);
export type FrameContent = typeof FrameContent.Type;

/**
 * Boutons d'urgence d'une piste : contenu normal, écran noir, logo de l'organisation,
 * ou texte masqué (fond conservé).
 */
export const Cover = Schema.Literals(["none", "black", "logo", "hideText"]);
export type Cover = typeof Cover.Type;

/** Minuteur du retour scène, piloté depuis la régie (compte à rebours). */
export const StageTimer = Schema.Struct({
  durationMs: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 24 * 3600 * 1000 })),
  /** Temps écoulé avant le démarrage en cours. */
  elapsedMs: Schema.Int,
  /** Heure serveur du démarrage en cours, ou `null` à l'arrêt. */
  runningSince: Schema.NullOr(Schema.Number),
});
export type StageTimer = typeof StageTimer.Type;

export const idleTimer: StageTimer = { durationMs: 0, elapsedMs: 0, runningSince: null };

/** Temps restant, négatif au-delà de la durée prévue. */
export const remainingMs = (timer: StageTimer, now: number) =>
  timer.durationMs -
  timer.elapsedMs -
  (timer.runningSince === null ? 0 : Math.max(0, now - timer.runningSince));

/** Ce que le retour scène affiche en plus de la diapo courante. */
export const StageInfo = Schema.Struct({
  next: FrameContent,
  notes: Schema.NullOr(Schema.String),
  timer: StageTimer,
});
export type StageInfo = typeof StageInfo.Type;

/** Image courante diffusée aux sorties d'une organisation. */
export class Frame extends Schema.Class<Frame>("Frame")({
  version: Schema.Int,
  /** Bouton d'urgence actif : le contenu est conservé mais masqué. */
  cover: Cover,
  content: FrameContent,
  /** Infos du retour scène (piste Salle uniquement). */
  stage: Schema.NullOr(StageInfo),
  updatedAt: Schema.Number,
}) {}

export const initialFrame = new Frame({
  version: 0,
  cover: "none",
  content: { _tag: "Blank" },
  stage: null,
  updatedAt: 0,
});

/** Piste de diffusion : la salle alimente salle et retour, le stream a sa propre piste. */
export const Track = Schema.Literals(["room", "stream"]);
export type Track = typeof Track.Type;
