import { describe, expect, it } from "@effect/vitest";
import { Actor, OrganizationId, UserId } from "@projection/shared-kernel";
import { Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";

import { IdentityRpcs } from "../src/api/contract";
import { ActorMiddlewareLive, IdentityHandlersLive } from "../src/api/handlers";
import { Authentication } from "../src/application/Authentication";
import { NoActiveOrganization, Unauthenticated } from "../src/domain/errors";

const actor = new Actor({
  userId: UserId.make("user-1"),
  organizationId: OrganizationId.make("org-1"),
  role: "admin",
});

const withAuthentication = (result: Effect.Effect<Actor, Unauthenticated | NoActiveOrganization>) =>
  Layer.mergeAll(IdentityHandlersLive, ActorMiddlewareLive).pipe(
    Layer.provide(Layer.succeed(Authentication, Authentication.of({ resolveActor: () => result }))),
  );

describe("ActorMiddleware", () => {
  it.effect("fournit CurrentActor aux handlers", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(IdentityRpcs);
      const whoAmI = yield* client.IdentityWhoAmI();
      expect(whoAmI.organizationId).toBe("org-1");
      expect(whoAmI.role).toBe("admin");
    }).pipe(Effect.provide(withAuthentication(Effect.succeed(actor)))),
  );

  it.effect("renvoie Unauthenticated sans session", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(IdentityRpcs);
      const error = yield* client.IdentityWhoAmI().pipe(Effect.flip);
      expect(error._tag).toBe("Unauthenticated");
    }).pipe(Effect.provide(withAuthentication(Effect.fail(new Unauthenticated())))),
  );

  it.effect("renvoie NoActiveOrganization sans organisation active", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(IdentityRpcs);
      const error = yield* client.IdentityWhoAmI().pipe(Effect.flip);
      expect(error._tag).toBe("NoActiveOrganization");
    }).pipe(Effect.provide(withAuthentication(Effect.fail(new NoActiveOrganization())))),
  );
});
