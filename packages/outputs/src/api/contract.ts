import { ActorMiddleware } from "@projection/identity/contract";
import { SlideTheme, Splitting } from "@projection/presentation/domain";
import { Forbidden, OutputId, ProjectId } from "@projection/shared-kernel";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  DisplayFrame,
  InvalidDisplayToken,
  LastOutput,
  Output,
  OutputName,
  OutputNotFound,
  OutputType,
  SplittingSettings,
} from "../domain/Output";

/** Gestion des sorties (opérateurs connectés ; modifications réservées propriétaire/admin). */
export const OutputsRpcs = RpcGroup.make(
  Rpc.make("OutputsList", { payload: { projectId: ProjectId }, success: Schema.Array(Output) }),
  Rpc.make("OutputsCreate", {
    payload: { projectId: ProjectId, name: OutputName, type: OutputType },
    success: Output,
    error: Forbidden,
  }),
  Rpc.make("OutputsRename", {
    payload: { id: OutputId, name: OutputName },
    success: Output,
    error: Schema.Union([OutputNotFound, Forbidden]),
  }),
  Rpc.make("OutputsRemove", {
    payload: { id: OutputId },
    error: Schema.Union([OutputNotFound, LastOutput, Forbidden]),
  }),
  /** Thème de la sortie ; `null` remet celui par défaut de son type. */
  Rpc.make("OutputsSetTheme", {
    payload: { id: OutputId, theme: Schema.NullOr(SlideTheme) },
    success: Output,
    error: Schema.Union([OutputNotFound, Forbidden]),
  }),
  Rpc.make("OutputsRegenerateToken", {
    payload: { id: OutputId },
    success: Output,
    error: Schema.Union([OutputNotFound, Forbidden]),
  }),
  Rpc.make("OutputsIdentify", { payload: { id: OutputId }, error: OutputNotFound }),
  Rpc.make("OutputsSplitting", { success: SplittingSettings }),
  Rpc.make("OutputsUpdateSplitting", {
    payload: { room: Splitting, stream: Splitting },
    success: SplittingSettings,
    error: Forbidden,
  }),
).middleware(ActorMiddleware);

/** Flux des écrans : public, authentifié uniquement par le token de la sortie. */
export const DisplayRpcs = RpcGroup.make(
  Rpc.make("DisplayWatch", {
    payload: { token: Schema.String },
    success: DisplayFrame,
    error: InvalidDisplayToken,
    stream: true,
  }),
);
