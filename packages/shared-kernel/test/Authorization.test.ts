import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { requireRole } from "../src/Authorization";
import { Actor, CurrentActor, type Role } from "../src/CurrentActor";
import { OrganizationId, UserId } from "../src/Ids";

const asRole = (role: Role) =>
  Effect.provideService(
    CurrentActor,
    new Actor({ userId: UserId.make("u"), organizationId: OrganizationId.make("o"), role }),
  );

describe("requireRole", () => {
  it.effect("laisse passer un rôle autorisé", () =>
    Effect.gen(function* () {
      const actor = yield* requireRole("owner", "admin");
      expect(actor.role).toBe("admin");
    }).pipe(asRole("admin")),
  );

  it.effect("refuse un rôle non autorisé", () =>
    Effect.gen(function* () {
      const error = yield* requireRole("owner", "admin").pipe(Effect.flip);
      expect(error._tag).toBe("Forbidden");
      expect(error.requiredRoles).toEqual(["owner", "admin"]);
    }).pipe(asRole("operator")),
  );
});
