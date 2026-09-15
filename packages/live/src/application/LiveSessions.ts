import {
  CurrentActor,
  type OrganizationId,
  type ProjectId,
  type ProjectItemId,
} from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Option, Semaphore, Stream, SubscriptionRef } from "effect";

import type { Deck } from "../domain/Deck";
import {
  type LiveCursor,
  type LiveItemNotFound,
  type LiveProjectNotFound,
  LiveSession,
  LiveSnapshot,
  NoLiveProject,
  idleSession,
} from "../domain/LiveSession";
import {
  contentAt,
  firstCursor,
  goToCursor,
  nextCursor,
  normalizeCursor,
  previousCursor,
} from "../domain/Navigation";
import { LiveFrames } from "./LiveFrames";
import { DeckSource, LiveSessionRepository } from "./ports";

interface Draft {
  readonly deck: Deck | null;
  readonly projectId: ProjectId | null;
  readonly cursor: LiveCursor | null;
  readonly blackout: boolean;
}

interface OrganizationState {
  readonly ref: SubscriptionRef.SubscriptionRef<LiveSnapshot>;
  readonly lock: Semaphore.Semaphore;
}

type Command<E = never> = Effect.Effect<LiveSnapshot, E, CurrentActor>;

/**
 * Régie : une session par organisation, partagée par toutes les régies ouvertes.
 * Chaque commande est sérialisée, persistée, diffusée aux régies et publiée aux sorties.
 */
export class LiveSessions extends Context.Service<
  LiveSessions,
  {
    readonly watch: Stream.Stream<LiveSnapshot, never, CurrentActor>;
    start(projectId: ProjectId): Command<LiveProjectNotFound>;
    goTo(itemId: ProjectItemId, slideIndex: number): Command<NoLiveProject | LiveItemNotFound>;
    readonly next: Command<NoLiveProject>;
    readonly previous: Command<NoLiveProject>;
    setBlackout(blackout: boolean): Command;
    /** Relit le projet (éléments ajoutés, réordonnés, retirés) en gardant la position. */
    readonly refresh: Command;
    readonly stop: Command;
  }
>()("@projection/live/LiveSessions") {
  static readonly layer = Layer.effect(
    LiveSessions,
    Effect.gen(function* () {
      const repository = yield* LiveSessionRepository;
      const decks = yield* DeckSource;
      const frames = yield* LiveFrames;
      const states = new Map<OrganizationId, OrganizationState>();
      const initLock = yield* Semaphore.make(1);

      const publish = (snapshot: LiveSnapshot) =>
        frames.publish(
          snapshot.session.organizationId,
          contentAt(snapshot.deck, snapshot.session.cursor),
          snapshot.session.blackout,
        );

      const tryResolve = (projectId: ProjectId) =>
        decks.resolve(projectId).pipe(
          Effect.map(Option.some),
          Effect.catchTag("LiveProjectNotFound", () => Effect.succeed(Option.none<Deck>())),
        );

      /** État de l'organisation, chargé depuis la base au premier accès (et republié). */
      const stateFor = Effect.gen(function* () {
        const { organizationId } = yield* CurrentActor;
        const cached = states.get(organizationId);
        if (cached !== undefined) return cached;

        return yield* Semaphore.withPermits(
          initLock,
          1,
        )(
          Effect.gen(function* () {
            const existing = states.get(organizationId);
            if (existing !== undefined) return existing;

            const stored = Option.getOrElse(yield* repository.load(organizationId), () =>
              idleSession(organizationId),
            );
            const deck =
              stored.projectId === null ? Option.none<Deck>() : yield* tryResolve(stored.projectId);
            const snapshot = Option.match(deck, {
              onNone: () =>
                new LiveSnapshot({
                  session: new LiveSession({ ...stored, projectId: null, cursor: null }),
                  deck: null,
                }),
              onSome: (resolved) =>
                new LiveSnapshot({
                  session: new LiveSession({
                    ...stored,
                    cursor: normalizeCursor(resolved, stored.cursor),
                  }),
                  deck: resolved,
                }),
            });

            const state: OrganizationState = {
              ref: yield* SubscriptionRef.make(snapshot),
              lock: yield* Semaphore.make(1),
            };
            states.set(organizationId, state);
            yield* publish(snapshot);
            return state;
          }),
        );
      });

      const command = <E>(
        transform: (current: LiveSnapshot) => Effect.Effect<Draft, E, CurrentActor>,
      ) =>
        Effect.gen(function* () {
          const state = yield* stateFor;
          return yield* Semaphore.withPermits(
            state.lock,
            1,
          )(
            Effect.gen(function* () {
              const current = yield* SubscriptionRef.get(state.ref);
              const draft = yield* transform(current);
              const now = yield* Clock.currentTimeMillis;
              const snapshot = new LiveSnapshot({
                deck: draft.deck,
                session: new LiveSession({
                  organizationId: current.session.organizationId,
                  projectId: draft.projectId,
                  cursor: draft.cursor,
                  blackout: draft.blackout,
                  version: current.session.version + 1,
                  updatedAt: now,
                }),
              });
              yield* repository.save(snapshot.session);
              yield* SubscriptionRef.set(state.ref, snapshot);
              yield* publish(snapshot);
              return snapshot;
            }),
          );
        });

      const keep = (current: LiveSnapshot): Draft => ({
        deck: current.deck,
        projectId: current.session.projectId,
        cursor: current.session.cursor,
        blackout: current.session.blackout,
      });

      const requireDeck = (current: LiveSnapshot) =>
        current.deck === null ? Effect.fail(new NoLiveProject()) : Effect.succeed(current.deck);

      return LiveSessions.of({
        watch: Stream.unwrap(Effect.map(stateFor, (state) => SubscriptionRef.changes(state.ref))),

        start: (projectId) =>
          command((current) =>
            decks.resolve(projectId).pipe(
              Effect.map((deck): Draft => ({
                deck,
                projectId,
                cursor: firstCursor(deck),
                blackout: current.session.blackout,
              })),
            ),
          ).pipe(Effect.withSpan("LiveSessions.start")),

        goTo: (itemId, slideIndex) =>
          command((current) =>
            Effect.gen(function* () {
              const deck = yield* requireDeck(current);
              const cursor = yield* goToCursor(deck, itemId, slideIndex);
              return { ...keep(current), cursor };
            }),
          ).pipe(Effect.withSpan("LiveSessions.goTo")),

        next: command((current) =>
          Effect.map(requireDeck(current), (deck) => ({
            ...keep(current),
            cursor: nextCursor(deck, current.session.cursor),
          })),
        ).pipe(Effect.withSpan("LiveSessions.next")),

        previous: command((current) =>
          Effect.map(requireDeck(current), (deck) => ({
            ...keep(current),
            cursor: previousCursor(deck, current.session.cursor),
          })),
        ).pipe(Effect.withSpan("LiveSessions.previous")),

        setBlackout: (blackout) =>
          command((current) => Effect.succeed({ ...keep(current), blackout })).pipe(
            Effect.withSpan("LiveSessions.setBlackout"),
          ),

        refresh: command((current) => {
          const { projectId, cursor, blackout } = current.session;
          if (projectId === null) return Effect.succeed(keep(current));
          return Effect.map(
            tryResolve(projectId),
            Option.match({
              onNone: (): Draft => ({ deck: null, projectId: null, cursor: null, blackout }),
              onSome: (deck): Draft => ({
                deck,
                projectId,
                cursor: normalizeCursor(deck, cursor),
                blackout,
              }),
            }),
          );
        }).pipe(Effect.withSpan("LiveSessions.refresh")),

        stop: command(() =>
          Effect.succeed<Draft>({ deck: null, projectId: null, cursor: null, blackout: false }),
        ).pipe(Effect.withSpan("LiveSessions.stop")),
      });
    }),
  );
}
