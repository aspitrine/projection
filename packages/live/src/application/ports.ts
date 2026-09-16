import type { CurrentActor, OrganizationId, ProjectId } from "@projection/shared-kernel";
import { Context, Effect, Layer, Option, Ref, Stream } from "effect";

import type { Deck } from "../domain/Deck";
import type { LiveEditFailed, LiveProjectNotFound, LiveSession } from "../domain/LiveSession";

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

/**
 * Port : édition d'une section de chant depuis la régie (bibliothèque songs).
 * Implémenté dans la composition root ; dernière écriture gagnante.
 */
export class SongEditing extends Context.Service<
  SongEditing,
  {
    updateSection(
      songId: string,
      sectionId: string,
      lines: ReadonlyArray<string>,
    ): Effect.Effect<
      { readonly title: string; readonly section: string },
      LiveEditFailed,
      CurrentActor
    >;
  }
>()("@projection/live/SongEditing") {}

/**
 * Port de persistance de la session live (une par organisation).
 *
 * `changed` porte le multi-instance : une régie qui pilote depuis une instance doit
 * réveiller les régies branchées sur les autres, qui relisent alors la session.
 */
export class LiveSessionRepository extends Context.Service<
  LiveSessionRepository,
  {
    load(organizationId: OrganizationId): Effect.Effect<Option.Option<LiveSession>>;
    save(session: LiveSession): Effect.Effect<void>;
    /** Signale aux autres instances que la session de cette organisation a changé. */
    announce(organizationId: OrganizationId): Effect.Effect<void>;
    /** Organisations dont la session a changé ailleurs (jamais les siennes). */
    readonly changed: Stream.Stream<OrganizationId>;
  }
>()("@projection/live/LiveSessionRepository") {
  static readonly layerMemory = Layer.effect(
    LiveSessionRepository,
    Effect.map(Ref.make(new Map<OrganizationId, LiveSession>()), (store) =>
      LiveSessionRepository.of({
        // Une seule instance en mémoire : personne à prévenir, personne à écouter.
        announce: () => Effect.void,
        changed: Stream.empty,
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
