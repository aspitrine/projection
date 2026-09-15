import { Layer } from "effect";

import { ActorMiddlewareLive, IdentityHandlersLive } from "./api/handlers";
import { type Auth, layerAuthentication } from "./infrastructure/BetterAuth";

export { Authentication } from "./application/Authentication";
export {
  type Auth,
  type AuthConfig,
  createAuth,
  migrateAuthSchema,
} from "./infrastructure/BetterAuth";

/** Handlers du contexte + middleware `ActorMiddleware` utilisé par les autres contextes. */
export const layerIdentity = (auth: Auth) =>
  Layer.mergeAll(IdentityHandlersLive, ActorMiddlewareLive).pipe(
    Layer.provide(layerAuthentication(auth)),
  );
