import { ActorMiddleware } from "@projection/identity/contract";
import { MediaId } from "@projection/shared-kernel";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  MediaAsset,
  MediaNotFound,
  MediaName,
  MediaTooLarge,
  MediaUpload,
  MediaUploadInput,
  UnsupportedMedia,
} from "../domain/Media";

export const MediaRpcs = RpcGroup.make(
  Rpc.make("MediaList", { success: Schema.Array(MediaAsset) }),
  /** Le navigateur téléverse ensuite directement vers le stockage avec l'URL signée. */
  Rpc.make("MediaRequestUpload", {
    payload: MediaUploadInput,
    success: MediaUpload,
    error: Schema.Union([UnsupportedMedia, MediaTooLarge]),
  }),
  Rpc.make("MediaConfirmUpload", {
    payload: { id: MediaId },
    success: MediaAsset,
    error: MediaNotFound,
  }),
  Rpc.make("MediaUrl", { payload: { id: MediaId }, success: Schema.String, error: MediaNotFound }),
  Rpc.make("MediaRename", {
    payload: { id: MediaId, name: MediaName },
    success: MediaAsset,
    error: MediaNotFound,
  }),
  Rpc.make("MediaDelete", { payload: { id: MediaId }, error: MediaNotFound }),
).middleware(ActorMiddleware);
