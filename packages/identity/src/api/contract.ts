import { Actor, CurrentActor } from "@projection/shared-kernel";
import { Schema } from "effect";
import { Rpc, RpcGroup, RpcMiddleware } from "effect/unstable/rpc";

import { NoActiveOrganization, Unauthenticated } from "../domain/errors";

export { NoActiveOrganization, Unauthenticated } from "../domain/errors";

/**
 * Middleware à appliquer à tout groupe RPC métier : fournit `CurrentActor`
 * ou échoue avec une erreur typée côté client.
 */
export class ActorMiddleware extends RpcMiddleware.Service<
  ActorMiddleware,
  { provides: CurrentActor }
>()("@projection/identity/ActorMiddleware", {
  error: Schema.Union([Unauthenticated, NoActiveOrganization]),
}) {}

export const IdentityRpcs = RpcGroup.make(
  Rpc.make("IdentityWhoAmI", { success: Actor }),
).middleware(ActorMiddleware);
