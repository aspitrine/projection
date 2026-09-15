import { ActorMiddleware } from "@projection/identity/contract";
import { Forbidden, OutputId } from "@projection/shared-kernel";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { DisplayFrame, InvalidDisplayToken, Output, OutputNotFound } from "../domain/Output";

/** Gestion des sorties (opérateurs connectés). */
export const OutputsRpcs = RpcGroup.make(
  Rpc.make("OutputsList", { success: Schema.Array(Output) }),
  Rpc.make("OutputsRegenerateToken", {
    payload: { id: OutputId },
    success: Output,
    error: Schema.Union([OutputNotFound, Forbidden]),
  }),
  Rpc.make("OutputsIdentify", { payload: { id: OutputId }, error: OutputNotFound }),
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
