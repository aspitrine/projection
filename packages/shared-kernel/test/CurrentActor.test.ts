import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { Actor } from "../src/CurrentActor";

const decodeActor = Schema.decodeUnknownEffect(Actor);

describe("Actor", () => {
  it.effect("décode un acteur valide", () =>
    Effect.gen(function* () {
      const actor = yield* decodeActor({
        userId: "user-1",
        organizationId: "org-1",
        role: "operator",
      });
      expect(actor.role).toBe("operator");
    }),
  );

  it.effect("rejette un rôle inconnu", () =>
    Effect.gen(function* () {
      const error = yield* decodeActor({
        userId: "user-1",
        organizationId: "org-1",
        role: "guest",
      }).pipe(Effect.flip);
      expect(error._tag).toBe("SchemaError");
    }),
  );
});
