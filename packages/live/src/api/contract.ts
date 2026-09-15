import { ActorMiddleware } from "@projection/identity/contract";
import { ProjectId, ProjectItemId } from "@projection/shared-kernel";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  LiveItemNotFound,
  LiveProjectNotFound,
  LiveSnapshot,
  NoLiveProject,
} from "../domain/LiveSession";

export const LiveRpcs = RpcGroup.make(
  /** État complet puis chaque changement ; se réabonner resynchronise la régie. */
  Rpc.make("LiveWatch", { success: LiveSnapshot, stream: true }),
  Rpc.make("LiveStart", {
    payload: { projectId: ProjectId },
    success: LiveSnapshot,
    error: LiveProjectNotFound,
  }),
  Rpc.make("LiveGoTo", {
    payload: { itemId: ProjectItemId, slideIndex: Schema.Int },
    success: LiveSnapshot,
    error: Schema.Union([NoLiveProject, LiveItemNotFound]),
  }),
  Rpc.make("LiveNext", { success: LiveSnapshot, error: NoLiveProject }),
  Rpc.make("LivePrevious", { success: LiveSnapshot, error: NoLiveProject }),
  Rpc.make("LiveSetBlackout", { payload: { blackout: Schema.Boolean }, success: LiveSnapshot }),
  Rpc.make("LiveStreamGoTo", {
    payload: { itemId: ProjectItemId, slideIndex: Schema.Int, part: Schema.Int },
    success: LiveSnapshot,
    error: Schema.Union([NoLiveProject, LiveItemNotFound]),
  }),
  Rpc.make("LiveStreamNext", { success: LiveSnapshot, error: NoLiveProject }),
  Rpc.make("LiveStreamPrevious", { success: LiveSnapshot, error: NoLiveProject }),
  Rpc.make("LiveStreamSetLinked", { payload: { linked: Schema.Boolean }, success: LiveSnapshot }),
  Rpc.make("LiveRefresh", { success: LiveSnapshot }),
  Rpc.make("LiveStop", { success: LiveSnapshot }),
).middleware(ActorMiddleware);
