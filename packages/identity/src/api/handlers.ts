import { CurrentActor } from "@projection/shared-kernel";
import { Effect, Layer } from "effect";

import { Authentication } from "../application/Authentication";
import { ActorMiddleware, IdentityRpcs } from "./contract";

export const ActorMiddlewareLive = Layer.effect(
  ActorMiddleware,
  Effect.gen(function* () {
    const authentication = yield* Authentication;

    return ActorMiddleware.of((effect, { headers }) =>
      authentication
        .resolveActor(headers)
        .pipe(Effect.flatMap((actor) => Effect.provideService(effect, CurrentActor, actor))),
    );
  }),
);

export const IdentityHandlersLive = IdentityRpcs.toLayer({
  IdentityWhoAmI: () =>
    Effect.gen(function* () {
      return yield* CurrentActor;
    }),
});
