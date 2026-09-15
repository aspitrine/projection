import { Effect, Schema } from "effect";

import { CurrentActor, Role } from "./CurrentActor";

export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
  requiredRoles: Schema.Array(Role),
}) {}

/** Vérifie que l'acteur courant a l'un des rôles demandés. */
export const requireRole = Effect.fnUntraced(function* (...allowed: ReadonlyArray<Role>) {
  const actor = yield* CurrentActor;
  if (!allowed.includes(actor.role)) {
    return yield* new Forbidden({ requiredRoles: allowed });
  }
  return actor;
});
