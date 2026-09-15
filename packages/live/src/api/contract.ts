import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { LiveState } from "../domain/LiveState";

export const LiveRpcs = RpcGroup.make(
  /** Émet l'état courant puis chaque changement. Se réabonner resynchronise l'état complet. */
  Rpc.make("LiveWatch", { success: LiveState, stream: true }),
  Rpc.make("LiveGoTo", { payload: { slideIndex: Schema.Int }, success: LiveState }),
  Rpc.make("LiveToggleBlackout", { success: LiveState }),
);
