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
  type StreamCursor,
  idleSession,
} from "../domain/LiveSession";
import {
  contentAt,
  firstCursor,
  followRoom,
  goToCursor,
  goToStreamCursor,
  nextCursor,
  nextStreamCursor,
  normalizeCursor,
  previousCursor,
  previousStreamCursor,
  reconcileStream,
  streamContentAt,
  streamPositions,
} from "../domain/Navigation";
import { LiveFrames } from "./LiveFrames";
import { DeckSource, LiveSessionRepository } from "./ports";

interface Draft {
  readonly deck: Deck | null;
  readonly projectId: ProjectId | null;
  readonly cursor: LiveCursor | null;
  readonly blackout: boolean;
  readonly streamLinked: boolean;
  readonly streamCursor: StreamCursor | null;
}

interface OrganizationState {
  readonly ref: SubscriptionRef.SubscriptionRef<LiveSnapshot>;
  readonly lock: Semaphore.Semaphore;
}

type Command<E = never> = Effect.Effect<LiveSnapshot, E, CurrentActor>;

const idleDraft = (streamLinked: boolean, blackout: boolean): Draft => ({
  deck: null,
  projectId: null,
  cursor: null,
  blackout,
  streamLinked,
  streamCursor: null,
});

/**
 * Régie : une session par organisation, partagée par toutes les régies ouvertes.
 * Deux pistes : Salle (sorties salle et retour) et Stream. Chaque commande est
 * sérialisée, persistée, diffusée aux régies et publiée aux sorties de chaque piste.
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
    /** Stream : partie précise ; une autre diapo que celle de la salle délie les pistes. */
    streamGoTo(
      itemId: ProjectItemId,
      slideIndex: number,
      part: number,
    ): Command<NoLiveProject | LiveItemNotFound>;
    readonly streamNext: Command<NoLiveProject>;
    readonly streamPrevious: Command<NoLiveProject>;
    /** Lier recale le stream sur la diapo de la salle. */
    setStreamLinked(linked: boolean): Command;
    /** Relit le projet (éléments ajoutés, réordonnés, retirés) en gardant les positions. */
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

      const publish = (snapshot: LiveSnapshot) => {
        const { organizationId, cursor, streamCursor, blackout } = snapshot.session;
        return Effect.all(
          [
            frames.publish(organizationId, "room", contentAt(snapshot.deck, cursor), blackout),
            frames.publish(
              organizationId,
              "stream",
              streamContentAt(snapshot.deck, streamCursor),
              blackout,
            ),
          ],
          { discard: true },
        );
      };

      const tryResolve = (projectId: ProjectId) =>
        decks.resolve(projectId).pipe(
          Effect.map(Option.some),
          Effect.catchTag("LiveProjectNotFound", () => Effect.succeed(Option.none<Deck>())),
        );

      /** Recale les deux pistes sur un projet (re)lu. */
      const reconcile = (
        deck: Option.Option<Deck>,
        projectId: ProjectId | null,
        from: Pick<Draft, "cursor" | "streamCursor" | "streamLinked" | "blackout">,
      ): Draft =>
        Option.match(deck, {
          onNone: () => idleDraft(from.streamLinked, from.blackout),
          onSome: (resolved) => {
            const cursor = normalizeCursor(resolved, from.cursor);
            return {
              deck: resolved,
              projectId,
              cursor,
              blackout: from.blackout,
              streamLinked: from.streamLinked,
              streamCursor: reconcileStream(resolved, cursor, from.streamCursor, from.streamLinked),
            };
          },
        });

      const toSnapshot = (
        draft: Draft,
        organizationId: OrganizationId,
        version: number,
        updatedAt: number,
      ) =>
        new LiveSnapshot({
          deck: draft.deck,
          session: new LiveSession({
            organizationId,
            projectId: draft.projectId,
            cursor: draft.cursor,
            blackout: draft.blackout,
            streamLinked: draft.streamLinked,
            streamCursor: draft.streamCursor,
            version,
            updatedAt,
          }),
        });

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
            const snapshot = toSnapshot(
              reconcile(deck, stored.projectId, stored),
              organizationId,
              stored.version,
              stored.updatedAt,
            );

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
              const snapshot = toSnapshot(
                draft,
                current.session.organizationId,
                current.session.version + 1,
                now,
              );
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
        streamLinked: current.session.streamLinked,
        streamCursor: current.session.streamCursor,
      });

      /** Nouvelle position de la salle ; en mode lié, le stream suit. */
      const moveRoom = (current: LiveSnapshot, deck: Deck, cursor: LiveCursor | null): Draft => ({
        ...keep(current),
        cursor,
        streamCursor: current.session.streamLinked
          ? reconcileStream(deck, cursor, current.session.streamCursor, true)
          : current.session.streamCursor,
      });

      const requireDeck = (current: LiveSnapshot) =>
        current.deck === null ? Effect.fail(new NoLiveProject()) : Effect.succeed(current.deck);

      const moveStream = (move: typeof nextStreamCursor): Command<NoLiveProject> =>
        command((current) =>
          Effect.map(requireDeck(current), (deck) => {
            const { streamLinked, streamCursor, cursor } = current.session;
            const from = streamCursor ?? (streamLinked ? followRoom(cursor) : null);
            return { ...keep(current), streamCursor: move(deck, from, streamLinked) };
          }),
        );

      return LiveSessions.of({
        watch: Stream.unwrap(Effect.map(stateFor, (state) => SubscriptionRef.changes(state.ref))),

        start: (projectId) =>
          command((current) =>
            decks.resolve(projectId).pipe(
              Effect.map((deck): Draft => {
                const { streamLinked, blackout } = current.session;
                const cursor = firstCursor(deck);
                return {
                  deck,
                  projectId,
                  cursor,
                  blackout,
                  streamLinked,
                  streamCursor: streamLinked
                    ? followRoom(cursor)
                    : (streamPositions(deck)[0] ?? null),
                };
              }),
            ),
          ).pipe(Effect.withSpan("LiveSessions.start")),

        goTo: (itemId, slideIndex) =>
          command((current) =>
            Effect.gen(function* () {
              const deck = yield* requireDeck(current);
              return moveRoom(current, deck, yield* goToCursor(deck, itemId, slideIndex));
            }),
          ).pipe(Effect.withSpan("LiveSessions.goTo")),

        next: command((current) =>
          Effect.map(requireDeck(current), (deck) =>
            moveRoom(current, deck, nextCursor(deck, current.session.cursor)),
          ),
        ).pipe(Effect.withSpan("LiveSessions.next")),

        previous: command((current) =>
          Effect.map(requireDeck(current), (deck) =>
            moveRoom(current, deck, previousCursor(deck, current.session.cursor)),
          ),
        ).pipe(Effect.withSpan("LiveSessions.previous")),

        setBlackout: (blackout) =>
          command((current) => Effect.succeed({ ...keep(current), blackout })).pipe(
            Effect.withSpan("LiveSessions.setBlackout"),
          ),

        streamGoTo: (itemId, slideIndex, part) =>
          command((current) =>
            Effect.gen(function* () {
              const deck = yield* requireDeck(current);
              const streamCursor = yield* goToStreamCursor(deck, itemId, slideIndex, part);
              const { cursor, streamLinked } = current.session;
              const onRoomSlide =
                cursor !== null && cursor.itemId === itemId && cursor.slideIndex === slideIndex;
              return {
                ...keep(current),
                streamCursor,
                streamLinked: streamLinked && onRoomSlide,
              };
            }),
          ).pipe(Effect.withSpan("LiveSessions.streamGoTo")),

        streamNext: moveStream(nextStreamCursor).pipe(Effect.withSpan("LiveSessions.streamNext")),

        streamPrevious: moveStream(previousStreamCursor).pipe(
          Effect.withSpan("LiveSessions.streamPrevious"),
        ),

        setStreamLinked: (linked) =>
          command((current) => {
            const { deck } = current;
            const streamCursor =
              linked && deck !== null
                ? reconcileStream(deck, current.session.cursor, current.session.streamCursor, true)
                : current.session.streamCursor;
            return Effect.succeed({ ...keep(current), streamLinked: linked, streamCursor });
          }).pipe(Effect.withSpan("LiveSessions.setStreamLinked")),

        refresh: command((current) => {
          const { projectId } = current.session;
          if (projectId === null) return Effect.succeed(keep(current));
          return Effect.map(tryResolve(projectId), (deck) =>
            reconcile(deck, projectId, current.session),
          );
        }).pipe(Effect.withSpan("LiveSessions.refresh")),

        stop: command(() => Effect.succeed(idleDraft(true, false))).pipe(
          Effect.withSpan("LiveSessions.stop"),
        ),
      });
    }),
  );
}
