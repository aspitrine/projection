import { OrganizationId, ProjectId, ProjectItemId } from "@projection/shared-kernel";
import { Schema } from "effect";

import { Deck } from "./Deck";

/** Position de diffusion : repérée par l'identifiant d'élément, stable si le projet est réordonné. */
export class LiveCursor extends Schema.Class<LiveCursor>("LiveCursor")({
  itemId: ProjectItemId,
  slideIndex: Schema.Int,
}) {}

export class LiveSession extends Schema.Class<LiveSession>("LiveSession")({
  organizationId: OrganizationId,
  projectId: Schema.NullOr(ProjectId),
  cursor: Schema.NullOr(LiveCursor),
  blackout: Schema.Boolean,
  version: Schema.Int,
  updatedAt: Schema.Number,
}) {}

export const idleSession = (organizationId: OrganizationId) =>
  new LiveSession({
    organizationId,
    projectId: null,
    cursor: null,
    blackout: false,
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
