import { ActorMiddleware } from "@projection/identity/contract";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { AgendaImportReport } from "../domain/Report";
import { InvalidVideoPsalm } from "../domain/VideoPsalm";

export const ImportsRpcs = RpcGroup.make(
  /** Agenda VideoPsalm (`.vpagd`) transmis en base64 : 16 Mo au plus. */
  Rpc.make("ImportsVideoPsalm", {
    payload: {
      fileName: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255)),
      content: Schema.String.check(Schema.isMaxLength(22_000_000)),
    },
    success: AgendaImportReport,
    error: InvalidVideoPsalm,
  }),
).middleware(ActorMiddleware);
