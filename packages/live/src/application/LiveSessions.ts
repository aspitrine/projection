import {
  CurrentActor,
  type OrganizationId,
  type ProjectId,
  type ProjectItemId,
} from "@projection/shared-kernel";
import {
  type Cover,
  type StageTimer,
  type Track,
  type VideoPlayback,
  idleTimer,
  idleVideo,
} from "@projection/presentation/domain";
import { Clock, Context, Effect, Layer, Option, Semaphore, Stream, SubscriptionRef } from "effect";

import type { Deck } from "../domain/Deck";
import {
  type LiveCursor,
  type LiveItemNotFound,
  type LiveProjectNotFound,
  LiveEdit,
  LiveEditFailed,
  LiveSession,
  LiveSnapshot,
  NoLiveProject,
  type StreamCursor,
  type StreamOverride,
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
  stageInfoAt,
  streamFrameContent,
  streamPositions,
  withPlayback,
} from "../domain/Navigation";
import { pauseTimer, resetTimer, setDuration, startTimer } from "../domain/Timer";
import { pauseVideo, playVideo, restartVideo } from "../domain/Video";
import { LiveFrames } from "./LiveFrames";
import { DeckSource, LiveSessionRepository, SongEditing } from "./ports";

interface Draft {
  readonly deck: Deck | null;
  readonly projectId: ProjectId | null;
  readonly cursor: LiveCursor | null;
  readonly roomCover: Cover;
  readonly streamCover: Cover;
  readonly streamLinked: boolean;
  readonly streamCursor: StreamCursor | null;
  readonly streamOverride: StreamOverride | null;
  readonly timer: StageTimer;
  /** Édition de paroles à signaler aux autres régies (non persistée). */
  readonly lastEdit: LiveEdit | null;
  /** Lecture vidéo en cours (non persistée). */
  readonly video: VideoPlayback;
}

interface OrganizationState {
  readonly ref: SubscriptionRef.SubscriptionRef<LiveSnapshot>;
  readonly lock: Semaphore.Semaphore;
}

type Command<E = never> = Effect.Effect<LiveSnapshot, E, CurrentActor>;

const idleDraft = (streamLinked: boolean, roomCover: Cover, streamCover: Cover): Draft => ({
  deck: null,
  projectId: null,
  cursor: null,
  roomCover,
  streamCover,
  streamLinked,
  streamCursor: null,
  streamOverride: null,
  timer: idleTimer,
  lastEdit: null,
  video: idleVideo,
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
    /** Boutons d'urgence d'une piste : noir, logo, texte masqué (fond conservé). */
    setCover(track: Track, cover: Cover): Command;
    /** Stream : partie précise ; une autre diapo que celle de la salle délie les pistes. */
    streamGoTo(
      itemId: ProjectItemId,
      slideIndex: number,
      part: number,
    ): Command<NoLiveProject | LiveItemNotFound>;
    readonly streamNext: Command<NoLiveProject>;
    readonly streamPrevious: Command<NoLiveProject>;
    /** Ajustement manuel : lignes choisies affichées sur le stream jusqu'à la prochaine navigation stream. */
    streamShowLines(override: StreamOverride): Command<NoLiveProject>;
    /** Abandonne la sélection manuelle et revient à la partie en cours. */
    readonly streamResume: Command;
    /** Lier recale le stream sur la diapo de la salle. */
    setStreamLinked(linked: boolean): Command;
    /** Édite une section du chant en cours : bibliothèque mise à jour puis diffusion. */
    editSection(
      itemId: ProjectItemId,
      sectionId: string,
      lines: ReadonlyArray<string>,
    ): Command<NoLiveProject | LiveEditFailed>;
    /** Lecture de la vidéo projetée, pilotée depuis la régie. */
    readonly playVideo: Command<NoLiveProject>;
    readonly pauseVideo: Command<NoLiveProject>;
    readonly restartVideo: Command<NoLiveProject>;
    /** Minuteur du retour scène : durée, démarrage, pause, remise à zéro. */
    setTimer(durationMs: number): Command;
    readonly startTimer: Command;
    readonly pauseTimer: Command;
    readonly resetTimer: Command;
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
      const songs = yield* SongEditing;
      const frames = yield* LiveFrames;
      const states = new Map<OrganizationId, OrganizationState>();
      const initLock = yield* Semaphore.make(1);

      const publish = (snapshot: LiveSnapshot) => {
        const { organizationId, cursor, streamCursor, streamOverride, roomCover, streamCover } =
          snapshot.session;
        const stage = stageInfoAt(snapshot.deck, cursor, snapshot.session.timer);
        const roomContent = withPlayback(contentAt(snapshot.deck, cursor), snapshot.video);
        return Effect.all(
          [
            frames.publish(organizationId, "room", roomContent, roomCover, stage),
            frames.publish(
              organizationId,
              "stream",
              withPlayback(
                streamFrameContent(snapshot.deck, streamCursor, streamOverride),
                snapshot.video,
              ),
              streamCover,
              null,
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
        from: Pick<
          Draft,
          | "cursor"
          | "streamCursor"
          | "streamLinked"
          | "streamOverride"
          | "roomCover"
          | "streamCover"
          | "timer"
        >,
      ): Draft =>
        Option.match(deck, {
          onNone: () => idleDraft(from.streamLinked, from.roomCover, from.streamCover),
          onSome: (resolved) => {
            const cursor = normalizeCursor(resolved, from.cursor);
            return {
              deck: resolved,
              projectId,
              cursor,
              roomCover: from.roomCover,
              streamCover: from.streamCover,
              streamLinked: from.streamLinked,
              streamCursor: reconcileStream(resolved, cursor, from.streamCursor, from.streamLinked),
              streamOverride: from.streamOverride,
              timer: from.timer,
              lastEdit: null,
              video: idleVideo,
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
          lastEdit: draft.lastEdit,
          video: draft.video,
          session: new LiveSession({
            organizationId,
            projectId: draft.projectId,
            cursor: draft.cursor,
            roomCover: draft.roomCover,
            streamCover: draft.streamCover,
            streamLinked: draft.streamLinked,
            streamCursor: draft.streamCursor,
            streamOverride: draft.streamOverride,
            timer: draft.timer,
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
        roomCover: current.session.roomCover,
        streamCover: current.session.streamCover,
        streamLinked: current.session.streamLinked,
        streamCursor: current.session.streamCursor,
        streamOverride: current.session.streamOverride,
        timer: current.session.timer,
        lastEdit: null,
        video: current.video,
      });

      /** Nouvelle position de la salle ; en mode lié, le stream suit. */
      const moveRoom = (current: LiveSnapshot, deck: Deck, cursor: LiveCursor | null): Draft => ({
        ...keep(current),
        cursor,
        // Changer de diapo arrête la vidéo précédente.
        video: idleVideo,
        streamCursor: current.session.streamLinked
          ? reconcileStream(deck, cursor, current.session.streamCursor, true)
          : current.session.streamCursor,
        // Lié : la sélection manuelle suit la salle et disparaît quand elle change de diapo.
        streamOverride: current.session.streamLinked ? null : current.session.streamOverride,
      });

      const requireDeck = (current: LiveSnapshot) =>
        current.deck === null ? Effect.fail(new NoLiveProject()) : Effect.succeed(current.deck);

      const moveStream = (move: typeof nextStreamCursor): Command<NoLiveProject> =>
        command((current) =>
          Effect.map(requireDeck(current), (deck) => {
            const { streamLinked, streamCursor, cursor } = current.session;
            const from = streamCursor ?? (streamLinked ? followRoom(cursor) : null);
            return {
              ...keep(current),
              streamCursor: move(deck, from, streamLinked),
              streamOverride: null,
            };
          }),
        );

      return LiveSessions.of({
        watch: Stream.unwrap(Effect.map(stateFor, (state) => SubscriptionRef.changes(state.ref))),

        start: (projectId) =>
          command((current) =>
            decks.resolve(projectId).pipe(
              Effect.map((deck): Draft => {
                const { streamLinked, roomCover, streamCover, timer } = current.session;
                const cursor = firstCursor(deck);
                return {
                  deck,
                  projectId,
                  cursor,
                  roomCover,
                  streamCover,
                  streamLinked,
                  streamCursor: streamLinked
                    ? followRoom(cursor)
                    : (streamPositions(deck)[0] ?? null),
                  streamOverride: null,
                  timer,
                  lastEdit: null,
                  video: idleVideo,
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

        setCover: (track, cover) =>
          command((current) =>
            Effect.succeed(
              track === "room"
                ? { ...keep(current), roomCover: cover }
                : { ...keep(current), streamCover: cover },
            ),
          ).pipe(Effect.withSpan("LiveSessions.setCover")),

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
                streamOverride: null,
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
            return Effect.succeed({
              ...keep(current),
              streamLinked: linked,
              streamCursor,
              streamOverride: linked ? null : current.session.streamOverride,
            });
          }).pipe(Effect.withSpan("LiveSessions.setStreamLinked")),

        streamShowLines: (override) =>
          command((current) =>
            Effect.map(requireDeck(current), () => ({
              ...keep(current),
              streamOverride: override,
            })),
          ).pipe(Effect.withSpan("LiveSessions.streamShowLines")),

        streamResume: command((current) =>
          Effect.succeed({ ...keep(current), streamOverride: null }),
        ).pipe(Effect.withSpan("LiveSessions.streamResume")),

        editSection: (itemId, sectionId, lines) =>
          command((current) =>
            Effect.gen(function* () {
              const deck = yield* requireDeck(current);
              const { projectId } = current.session;
              const item = deck.items.find((candidate) => candidate.itemId === itemId);
              if (item === undefined || item.sourceId === null || projectId === null) {
                return yield* new LiveEditFailed({ reason: "NotEditable" });
              }
              const edited = yield* songs.updateSection(item.sourceId, sectionId, lines);
              const now = yield* Clock.currentTimeMillis;
              const resolved = yield* tryResolve(projectId);
              return {
                ...reconcile(resolved, projectId, current.session),
                lastEdit: new LiveEdit({
                  itemId,
                  title: edited.title,
                  section: edited.section,
                  at: now,
                }),
              };
            }),
          ).pipe(Effect.withSpan("LiveSessions.editSection")),

        playVideo: command((current) =>
          Effect.map(Clock.currentTimeMillis, (now) => ({
            ...keep(current),
            video: playVideo(current.video, now),
          })),
        ).pipe(Effect.withSpan("LiveSessions.playVideo")),

        pauseVideo: command((current) =>
          Effect.map(Clock.currentTimeMillis, (now) => ({
            ...keep(current),
            video: pauseVideo(current.video, now),
          })),
        ).pipe(Effect.withSpan("LiveSessions.pauseVideo")),

        restartVideo: command((current) =>
          Effect.succeed({ ...keep(current), video: restartVideo() }),
        ).pipe(Effect.withSpan("LiveSessions.restartVideo")),

        setTimer: (durationMs) =>
          command((current) =>
            Effect.succeed({ ...keep(current), timer: setDuration(durationMs) }),
          ).pipe(Effect.withSpan("LiveSessions.setTimer")),

        startTimer: command((current) =>
          Effect.map(Clock.currentTimeMillis, (now) => ({
            ...keep(current),
            timer: startTimer(current.session.timer, now),
          })),
        ).pipe(Effect.withSpan("LiveSessions.startTimer")),

        pauseTimer: command((current) =>
          Effect.map(Clock.currentTimeMillis, (now) => ({
            ...keep(current),
            timer: pauseTimer(current.session.timer, now),
          })),
        ).pipe(Effect.withSpan("LiveSessions.pauseTimer")),

        resetTimer: command((current) =>
          Effect.succeed({ ...keep(current), timer: resetTimer(current.session.timer) }),
        ).pipe(Effect.withSpan("LiveSessions.resetTimer")),

        refresh: command((current) => {
          const { projectId } = current.session;
          if (projectId === null) return Effect.succeed(keep(current));
          return Effect.map(tryResolve(projectId), (deck) =>
            reconcile(deck, projectId, current.session),
          );
        }).pipe(Effect.withSpan("LiveSessions.refresh")),

        stop: command(() => Effect.succeed(idleDraft(true, "none", "none"))).pipe(
          Effect.withSpan("LiveSessions.stop"),
        ),
      });
    }),
  );
}
