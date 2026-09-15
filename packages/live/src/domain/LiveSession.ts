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

export class LiveSession extends Schema.Class<LiveSession>("LiveSession")({
  organizationId: OrganizationId,
  projectId: Schema.NullOr(ProjectId),
  cursor: Schema.NullOr(LiveCursor),
  blackout: Schema.Boolean,
  /** Lié : le stream suit la diapo de la salle et navigue dans ses parties. */
  streamLinked: Schema.Boolean,
  streamCursor: Schema.NullOr(StreamCursor),
  version: Schema.Int,
  updatedAt: Schema.Number,
}) {}

export const idleSession = (organizationId: OrganizationId) =>
  new LiveSession({
    organizationId,
    projectId: null,
    cursor: null,
    blackout: false,
    streamLinked: true,
    streamCursor: null,
    version: 0,
    updatedAt: 0,
  });

/** État diffusé aux régies : session et projet résolu. */
export class LiveSnapshot extends Schema.Class<LiveSnapshot>("LiveSnapshot")({
  session: LiveSession,
  deck: Schema.NullOr(Deck),
}) {}

export class LiveProjectNotFound extends Schema.TaggedError<LiveProjectNotFound>()(
  "LiveProjectNotFound",
  { projectId: ProjectId },
) {}

export class LiveItemNotFound extends Schema.TaggedError<LiveItemNotFound>()("LiveItemNotFound", {
  itemId: ProjectItemId,
}) {}

export class NoLiveProject extends Schema.TaggedError<NoLiveProject>()("NoLiveProject", {}) {}
