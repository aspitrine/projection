import { ActorMiddleware } from "@projection/identity/contract";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  InvalidReference,
  Passage,
  PassageNotFound,
  ScriptureMatch,
  Translation,
  UnknownTranslation,
} from "../domain/Scripture";

export const BibleRpcs = RpcGroup.make(
  Rpc.make("BibleTranslations", { success: Schema.Array(Translation) }),
  Rpc.make("BibleLookup", {
    payload: { translationId: Schema.String, reference: Schema.String },
    success: Passage,
    error: Schema.Union([InvalidReference, PassageNotFound, UnknownTranslation]),
  }),
  Rpc.make("BibleSearch", {
    payload: {
      translationId: Schema.String,
      query: Schema.String.check(Schema.isMaxLength(200)),
    },
    success: Schema.Array(ScriptureMatch),
    error: UnknownTranslation,
  }),
).middleware(ActorMiddleware);
