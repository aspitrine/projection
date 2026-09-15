import { Context, Schema } from "effect";

import { OrganizationId, UserId } from "./Ids";

export const Role = Schema.Literals(["owner", "admin", "operator"]);
export type Role = typeof Role.Type;

export class Actor extends Schema.Class<Actor>("Actor")({
  userId: UserId,
  organizationId: OrganizationId,
  role: Role,
}) {}

/** Utilisateur authentifié et organisation active de la requête en cours. */
export class CurrentActor extends Context.Service<CurrentActor, Actor>()(
  "@projection/shared-kernel/CurrentActor",
) {}
