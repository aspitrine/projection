import { ActorMiddleware } from "@projection/identity/contract";
import { ProjectId, ProjectItemId } from "@projection/shared-kernel";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  Project,
  ProjectInput,
  ProjectItemDraft,
  ProjectItemNotFound,
  ProjectNotFound,
  ProjectSummary,
} from "../domain/Project";

const ItemError = Schema.Union([ProjectNotFound, ProjectItemNotFound]);

export const ProjectsRpcs = RpcGroup.make(
  Rpc.make("ProjectsList", { success: Schema.Array(ProjectSummary) }),
  Rpc.make("ProjectsGet", { payload: { id: ProjectId }, success: Project, error: ProjectNotFound }),
  Rpc.make("ProjectsCreate", { payload: ProjectInput, success: Project }),
  Rpc.make("ProjectsUpdate", {
    payload: { id: ProjectId, input: ProjectInput },
    success: Project,
    error: ProjectNotFound,
  }),
  Rpc.make("ProjectsDelete", { payload: { id: ProjectId }, error: ProjectNotFound }),
  Rpc.make("ProjectsAddItem", {
    payload: {
      projectId: ProjectId,
      item: ProjectItemDraft,
      /** Position d'insertion ; `null` pour ajouter à la fin. */
      position: Schema.NullOr(Schema.Int),
    },
    success: Project,
    error: ProjectNotFound,
  }),
  Rpc.make("ProjectsRemoveItem", {
    payload: { projectId: ProjectId, itemId: ProjectItemId },
    success: Project,
    error: ItemError,
  }),
  Rpc.make("ProjectsMoveItem", {
    payload: { projectId: ProjectId, itemId: ProjectItemId, toIndex: Schema.Int },
    success: Project,
    error: ItemError,
  }),
).middleware(ActorMiddleware);
