import { Cover, StageTimer, idleTimer } from "@projection/presentation/domain";
import { OrganizationId, ProjectId, ProjectItemId } from "@projection/shared-kernel";
import { Schema } from "effect";

import { Deck } from "./Deck";

/** Position de la piste Salle : repérée par l'identifiant d'élément, stable si le projet est réordonné. */
export class LiveCursor extends Schema.Class<LiveCursor>("LiveCursor")({
  itemId: ProjectItemId,
  slideIndex: Schema.Int,
}) {}

/** Position de la piste Stream : une partie du sous-découpage d'une diapo. */
export class StreamCursor extends Schema.Class<StreamCursor>("StreamCursor")({
  itemId: ProjectItemId,
  slideIndex: Schema.Int,
  part: Schema.Int,
}) {}

/** Lignes choisies à la main pour le stream (1 à 12 lignes). */
export const StreamLines = Schema.Array(Schema.String.check(Schema.isMaxLength(500))).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(12),
);

/** Ajustement manuel : remplace la partie en cours sur le stream jusqu'à la prochaine navigation. */
export const StreamOverride = Schema.Struct({
  lines: StreamLines,
  caption: Schema.NullOr(Schema.String),
});
export type StreamOverride = typeof StreamOverride.Type;

export class LiveSession extends Schema.Class<LiveSession>("LiveSession")({
  organizationId: OrganizationId,
  projectId: Schema.NullOr(ProjectId),
  cursor: Schema.NullOr(LiveCursor),
  /** Boutons d'urgence de chaque piste. */
  roomCover: Cover,
  streamCover: Cover,
  /** Lié : le stream suit la diapo de la salle et navigue dans ses parties. */
  streamLinked: Schema.Boolean,
  streamCursor: Schema.NullOr(StreamCursor),
  streamOverride: Schema.NullOr(StreamOverride),
  /** Minuteur affiché sur le retour scène. */
  timer: StageTimer,
  version: Schema.Int,
  updatedAt: Schema.Number,
}) {}

export const idleSession = (organizationId: OrganizationId) =>
  new LiveSession({
    organizationId,
    projectId: null,
    cursor: null,
    roomCover: "none",
    streamCover: "none",
    streamLinked: true,
    streamCursor: null,
    streamOverride: null,
    timer: idleTimer,
    version: 0,
    updatedAt: 0,
  });

/** Dernière édition de paroles en direct, signalée aux autres régies. */
export class LiveEdit extends Schema.Class<LiveEdit>("LiveEdit")({
  itemId: ProjectItemId,
  title: Schema.String,
  section: Schema.String,
  at: Schema.Number,
}) {}

/** État diffusé aux régies : session et projet résolu. */
export class LiveSnapshot extends Schema.Class<LiveSnapshot>("LiveSnapshot")({
  session: LiveSession,
  deck: Schema.NullOr(Deck),
  /** Non persisté : disparaît au redémarrage. */
  lastEdit: Schema.NullOr(LiveEdit),
}) {}

export class LiveProjectNotFound extends Schema.TaggedError<LiveProjectNotFound>()(
  "LiveProjectNotFound",
  { projectId: ProjectId },
) {}

export class LiveItemNotFound extends Schema.TaggedError<LiveItemNotFound>()("LiveItemNotFound", {
  itemId: ProjectItemId,
}) {}

export class LiveEditFailed extends Schema.TaggedError<LiveEditFailed>()("LiveEditFailed", {
  reason: Schema.Literals(["NotEditable", "NotFound", "InvalidLyrics"]),
}) {}

export class NoLiveProject extends Schema.TaggedError<NoLiveProject>()("NoLiveProject", {}) {}
