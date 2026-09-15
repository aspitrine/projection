import type { Actor } from "@projection/shared-kernel";
import { Context, type Effect } from "effect";
import type { Headers } from "effect/unstable/http";

import type { NoActiveOrganization, Unauthenticated } from "../domain/errors";

/** Port : identifie l'acteur (utilisateur + organisation active + rôle) d'une requête. */
export class Authentication extends Context.Service<
  Authentication,
  {
    resolveActor(
      headers: Headers.Headers,
    ): Effect.Effect<Actor, Unauthenticated | NoActiveOrganization>;
  }
>()("@projection/identity/Authentication") {}
