import type { CurrentActor, OrganizationId, ProjectId } from "@projection/shared-kernel";
import { Context, Effect, Layer, Option, Ref } from "effect";

import type { Deck } from "../domain/Deck";
import type { LiveProjectNotFound, LiveSession } from "../domain/LiveSession";

/**
 * Port : résout un projet en diapos (chants, passages, diapos texte…).
 * Implémenté dans la composition root à partir des autres contextes.
 */
export class DeckSource extends Context.Service<
  DeckSource,
  {
    resolve(projectId: ProjectId): Effect.Effect<Deck, LiveProjectNotFound, CurrentActor>;
  }
>()("@projection/live/DeckSource") {}

/** Port de persistance de la session live (une par organisation). */
export class LiveSessionRepository extends Context.Service<
  LiveSessionRepository,
  {
    load(organizationId: OrganizationId): Effect.Effect<Option.Option<LiveSession>>;
    save(session: LiveSession): Effect.Effect<void>;
  }
>()("@projection/live/LiveSessionRepository") {
  static readonly layerMemory = Layer.effect(
    LiveSessionRepository,
    Effect.map(Ref.make(new Map<OrganizationId, LiveSession>()), (store) =>
      LiveSessionRepository.of({
        load: (organizationId) =>
          Ref.get(store).pipe(
            Effect.map((sessions) => Option.fromNullishOr(sessions.get(organizationId))),
          ),
        save: (session) =>
          Ref.update(store, (sessions) => new Map(sessions).set(session.organizationId, session)),
      }),
    ),
  );
}
