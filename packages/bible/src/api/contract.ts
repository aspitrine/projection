import { ActorMiddleware } from "@projection/identity/contract";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { Forbidden } from "@projection/shared-kernel";

import {
  InvalidReference,
  InvalidTranslationFile,
  Passage,
  PassageNotFound,
  ScriptureMatch,
  Translation,
  TranslationImported,
  TranslationInput,
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
  /** Import d'une traduction (USFM, OSIS ou Zefania) dans l'organisation : 30 Mo au plus. */
  Rpc.make("BibleImport", {
    payload: {
      input: TranslationInput,
      content: Schema.String.check(Schema.isMaxLength(30_000_000)),
    },
    success: TranslationImported,
    error: Schema.Union([InvalidTranslationFile, Forbidden]),
  }),
  Rpc.make("BibleDefaultTranslation", { success: Schema.NullOr(Schema.String) }),
  Rpc.make("BibleSetDefaultTranslation", {
    payload: { translationId: Schema.NullOr(Schema.String) },
    error: Schema.Union([UnknownTranslation, Forbidden]),
  }),
).middleware(ActorMiddleware);
