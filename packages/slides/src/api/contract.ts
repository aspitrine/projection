import { ActorMiddleware } from "@projection/identity/contract";
import { TextSlideId } from "@projection/shared-kernel";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
  EmptyTextSlide,
  TextSlide,
  TextSlideInput,
  TextSlideNotFound,
  TextSlideSummary,
} from "../domain/TextSlide";

export const SlidesRpcs = RpcGroup.make(
  Rpc.make("SlidesList", {
    payload: { search: Schema.NullOr(Schema.String) },
    success: Schema.Array(TextSlideSummary),
  }),
  Rpc.make("SlidesGet", {
    payload: { id: TextSlideId },
    success: TextSlide,
    error: TextSlideNotFound,
  }),
  Rpc.make("SlidesCreate", { payload: TextSlideInput, success: TextSlide, error: EmptyTextSlide }),
  Rpc.make("SlidesUpdate", {
    payload: { id: TextSlideId, input: TextSlideInput },
    success: TextSlide,
    error: Schema.Union([TextSlideNotFound, EmptyTextSlide]),
  }),
  Rpc.make("SlidesDelete", { payload: { id: TextSlideId }, error: TextSlideNotFound }),
).middleware(ActorMiddleware);
