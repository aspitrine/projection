import { ActorMiddleware } from "@projection/identity/contract";
import { SongId } from "@projection/shared-kernel";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { InvalidLyrics, SongNotFound } from "../domain/errors";
import { ImportFiles, ImportFormat, ImportReport } from "../domain/Import";
import { Song, SongInput, SongSummary } from "../domain/Song";

export const SongsRpcs = RpcGroup.make(
  Rpc.make("SongsList", {
    payload: { search: Schema.NullOr(Schema.String) },
    success: Schema.Array(SongSummary),
  }),
  Rpc.make("SongsGet", { payload: { id: SongId }, success: Song, error: SongNotFound }),
  Rpc.make("SongsCreate", { payload: SongInput, success: Song, error: InvalidLyrics }),
  Rpc.make("SongsUpdate", {
    payload: { id: SongId, input: SongInput },
    success: Song,
    error: Schema.Union([SongNotFound, InvalidLyrics]),
  }),
  Rpc.make("SongsDelete", { payload: { id: SongId }, error: SongNotFound }),
  Rpc.make("SongsImport", {
    payload: { format: ImportFormat, files: ImportFiles },
    success: ImportReport,
  }),
).middleware(ActorMiddleware);
