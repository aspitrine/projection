import { ActorMiddleware } from "@projection/identity/contract";
import { Cover, Track } from "@projection/presentation/domain";
import { ProjectId, ProjectItemId } from "@projection/shared-kernel";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  LiveItemNotFound,
  LiveProjectNotFound,
  LiveSnapshot,
  LiveEditFailed,
  NoLiveProject,
  StreamLines,
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
  /** Bouton d'urgence d'une piste (« none » revient au contenu). */
  Rpc.make("LiveSetCover", { payload: { track: Track, cover: Cover }, success: LiveSnapshot }),
  Rpc.make("LiveStreamGoTo", {
    payload: { itemId: ProjectItemId, slideIndex: Schema.Int, part: Schema.Int },
    success: LiveSnapshot,
    error: Schema.Union([NoLiveProject, LiveItemNotFound]),
  }),
  Rpc.make("LiveStreamNext", { success: LiveSnapshot, error: NoLiveProject }),
  Rpc.make("LiveStreamPrevious", { success: LiveSnapshot, error: NoLiveProject }),
  Rpc.make("LiveStreamSetLinked", { payload: { linked: Schema.Boolean }, success: LiveSnapshot }),
  Rpc.make("LiveStreamShowLines", {
    payload: { lines: StreamLines, caption: Schema.NullOr(Schema.String) },
    success: LiveSnapshot,
    error: NoLiveProject,
  }),
  Rpc.make("LiveStreamResume", { success: LiveSnapshot }),
  /** Édition en direct d'une section de chant (dernière écriture gagnante). */
  Rpc.make("LiveEditSection", {
    payload: {
      itemId: ProjectItemId,
      sectionId: Schema.String,
      lines: Schema.Array(Schema.String.check(Schema.isMaxLength(500))).check(
        Schema.isMinLength(1),
        Schema.isMaxLength(200),
      ),
    },
    success: LiveSnapshot,
    error: Schema.Union([NoLiveProject, LiveEditFailed]),
  }),
  Rpc.make("LiveVideoPlay", { success: LiveSnapshot, error: NoLiveProject }),
  Rpc.make("LiveVideoPause", { success: LiveSnapshot, error: NoLiveProject }),
  Rpc.make("LiveVideoRestart", { success: LiveSnapshot, error: NoLiveProject }),
  Rpc.make("LiveVideoSeek", {
    payload: { positionMs: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)) },
    success: LiveSnapshot,
    error: NoLiveProject,
  }),
  Rpc.make("LiveVideoDuration", {
    payload: { durationMs: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)) },
    success: LiveSnapshot,
    error: NoLiveProject,
  }),
  Rpc.make("LiveRefresh", { success: LiveSnapshot }),
).middleware(ActorMiddleware);
