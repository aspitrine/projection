import { describe, expect, it } from "@effect/vitest";
import type { Frame } from "@projection/presentation/domain";
import { idleTimer, idleVideo } from "@projection/presentation/domain";
import { Effect, Layer, Queue, Stream } from "effect";

import { LiveFrames } from "../src/application/LiveFrames";
import { LiveSessions } from "../src/application/LiveSessions";
import { LiveSessionRepository } from "../src/application/ports";
import { LiveCursor, LiveSession } from "../src/domain/LiveSession";
import {
  asActor,
  deckOf,
  item,
  itemId,
  makeDeckSource,
  makeSongEditing,
  videoItem,
  organizationId,
  projectId,
} from "./support";

const songEditing = makeSongEditing();

const layerWith = (source: ReturnType<typeof makeDeckSource>) =>
  LiveSessions.layer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        LiveSessionRepository.layerMemory,
        LiveFrames.layerMemory,
        source.layer,
        songEditing.layer,
      ),
    ),
  );

const screen = (frame: Frame) =>
  `${frame.cover === "none" ? "" : "[" + frame.cover + "] "}${frame.content._tag === "Lines" ? frame.content.lines.join(" ") : frame.content._tag}`;

const baseDeck = deckOf([item(1, ["A1", "A2"]), item(2, []), item(3, ["C1"])]);

describe("LiveSessions", () => {
  const source = makeDeckSource(baseDeck);

  it.effect("diffuse un projet et navigue en publiant l'image aux sorties", () =>
    Effect.gen(function* () {
      const sessions = yield* LiveSessions;
      const frames = yield* LiveFrames;
      const onScreen = Effect.map(frames.current(organizationId, "room"), screen);

      const started = yield* sessions.start(projectId).pipe(asActor());
      expect(started.deck?.projectName).toBe("Culte");
      expect(yield* onScreen).toBe("A1");

      yield* sessions.next.pipe(asActor());
      expect(yield* onScreen).toBe("A2");
      yield* sessions.next.pipe(asActor());
      expect(yield* onScreen).toBe("C1");
      yield* sessions.previous.pipe(asActor());
      expect(yield* onScreen).toBe("A2");

      yield* sessions.setCover("room", "black").pipe(asActor());
      expect(yield* onScreen).toBe("[black] A2");
      const jumped = yield* sessions.goTo(itemId(3), 0).pipe(asActor());
      expect(yield* onScreen).toBe("[black] C1");
      expect(jumped.session.version).toBe(6);

      expect((yield* sessions.goTo(itemId(2), 0).pipe(asActor(), Effect.flip))._tag).toBe(
        "LiveItemNotFound",
      );

      yield* sessions.stop.pipe(asActor());
      expect(yield* onScreen).toBe("Blank");
    }).pipe(Effect.provide(layerWith(source))),
  );

  it.effect("refuse de naviguer sans projet et signale un projet introuvable", () =>
    Effect.gen(function* () {
      const sessions = yield* LiveSessions;
      expect((yield* sessions.next.pipe(asActor(), Effect.flip))._tag).toBe("NoLiveProject");
      const missing = yield* sessions
        .start("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as typeof projectId)
        .pipe(asActor(), Effect.flip);
      expect(missing._tag).toBe("LiveProjectNotFound");
    }).pipe(Effect.provide(layerWith(makeDeckSource(baseDeck)))),
  );

  it.effect("garde la position quand le projet est modifié pendant le direct", () => {
    const editable = makeDeckSource(baseDeck);
    return Effect.gen(function* () {
      const sessions = yield* LiveSessions;
      const frames = yield* LiveFrames;
      yield* sessions.start(projectId).pipe(asActor());
      yield* sessions.next.pipe(asActor());

      editable.set(deckOf([item(4, ["D1"]), item(1, ["A1", "A2", "A3"])]));
      const inserted = yield* sessions.refresh.pipe(asActor());
      expect(inserted.session.cursor).toEqual(new LiveCursor({ itemId: itemId(1), slideIndex: 1 }));
      expect(screen(yield* frames.current(organizationId, "room"))).toBe("A2");

      editable.set(deckOf([item(4, ["D1"])]));
      const removed = yield* sessions.refresh.pipe(asActor());
      expect(removed.session.cursor).toBeNull();
      expect(screen(yield* frames.current(organizationId, "room"))).toBe("Blank");

      editable.set(null);
      const deleted = yield* sessions.refresh.pipe(asActor());
      expect(deleted.session.projectId).toBeNull();
      expect(deleted.deck).toBeNull();
    }).pipe(Effect.provide(layerWith(editable)));
  });

  it.effect("restaure la session persistée et republie l'image aux sorties", () =>
    Effect.gen(function* () {
      const repository = yield* LiveSessionRepository;
      yield* repository.save(
        new LiveSession({
          organizationId,
          projectId,
          cursor: new LiveCursor({ itemId: itemId(3), slideIndex: 0 }),
          roomCover: "black",
          streamCover: "none",
          streamLinked: true,
          streamCursor: null,
          streamOverride: null,
          timer: idleTimer,
          video: idleVideo,
          version: 7,
          updatedAt: 1,
        }),
      );

      const sessions = yield* LiveSessions;
      const frames = yield* LiveFrames;
      const restored = yield* sessions.watch.pipe(Stream.runHead, asActor());
      expect(restored._tag).toBe("Some");
      if (restored._tag === "Some") {
        expect(restored.value.session.version).toBe(7);
        expect(restored.value.deck?.items).toHaveLength(3);
      }
      expect(screen(yield* frames.current(organizationId, "room"))).toBe("[black] C1");
    }).pipe(Effect.provide(layerWith(makeDeckSource(baseDeck)))),
  );

  it.effect("synchronise toutes les régies ouvertes", () =>
    Effect.gen(function* () {
      const sessions = yield* LiveSessions;
      const first = yield* Queue.unbounded<number>();
      const second = yield* Queue.unbounded<number>();
      for (const queue of [first, second]) {
        yield* sessions.watch.pipe(
          Stream.runForEach((snapshot) => Queue.offer(queue, snapshot.session.version)),
          asActor(),
          Effect.forkChild,
        );
      }
      expect([yield* Queue.take(first), yield* Queue.take(second)]).toEqual([0, 0]);

      yield* sessions.start(projectId).pipe(asActor());
      yield* sessions.next.pipe(asActor());
      expect([yield* Queue.take(first), yield* Queue.take(first)]).toEqual([1, 2]);
      expect([yield* Queue.take(second), yield* Queue.take(second)]).toEqual([1, 2]);

      // Une autre organisation a sa propre session.
      const other = yield* sessions.watch.pipe(Stream.runHead, asActor("org-b"));
      expect(other._tag === "Some" && other.value.session.version).toBe(0);
    }).pipe(Effect.provide(layerWith(makeDeckSource(baseDeck)))),
  );

  it.effect("pistes Salle et Stream : liées puis déliées", () =>
    Effect.gen(function* () {
      const sessions = yield* LiveSessions;
      const frames = yield* LiveFrames;
      const onTrack = (track: "room" | "stream") =>
        Effect.map(frames.current(organizationId, track), screen);

      yield* sessions.start(projectId).pipe(asActor());
      expect([yield* onTrack("room"), yield* onTrack("stream")]).toEqual(["A1", "A1.1"]);

      // Lié : le stream défile les parties de la diapo de la salle, puis suit la salle.
      yield* sessions.streamNext.pipe(asActor());
      expect(yield* onTrack("stream")).toBe("A1.2");
      yield* sessions.streamNext.pipe(asActor());
      expect([yield* onTrack("room"), yield* onTrack("stream")]).toEqual(["A1", "A1.2"]);
      yield* sessions.next.pipe(asActor());
      expect([yield* onTrack("room"), yield* onTrack("stream")]).toEqual(["A2", "A2.1"]);

      // Délié : la salle avance seule, le stream parcourt le projet.
      yield* sessions.setStreamLinked(false).pipe(asActor());
      yield* sessions.next.pipe(asActor());
      expect([yield* onTrack("room"), yield* onTrack("stream")]).toEqual(["C1", "A2.1"]);
      yield* sessions.streamNext.pipe(asActor());
      yield* sessions.streamNext.pipe(asActor());
      expect(yield* onTrack("stream")).toBe("C1.1");

      // Relier recale le stream sur la diapo de la salle en gardant la partie.
      const relinked = yield* sessions.setStreamLinked(true).pipe(asActor());
      expect(relinked.session.streamLinked).toBe(true);
      expect(yield* onTrack("stream")).toBe("C1.1");

      // Envoyer une autre diapo au stream délie les pistes.
      const picked = yield* sessions.streamGoTo(itemId(1), 0, 1).pipe(asActor());
      expect(picked.session.streamLinked).toBe(false);
      expect([yield* onTrack("room"), yield* onTrack("stream")]).toEqual(["C1", "A1.2"]);

      yield* sessions.setCover("stream", "black").pipe(asActor());
      expect(yield* onTrack("stream")).toBe("[black] A1.2");

      const stopped = yield* sessions.stop.pipe(asActor());
      expect(stopped.session).toMatchObject({ streamLinked: true, streamCursor: null });
    }).pipe(
      Effect.provide(
        layerWith(makeDeckSource(deckOf([item(1, ["A1", "A2"], 2), item(3, ["C1"], 2)]))),
      ),
    ),
  );

  it.effect(
    "ajustement manuel : lignes choisies sur le stream jusqu'à la prochaine navigation",
    () =>
      Effect.gen(function* () {
        const sessions = yield* LiveSessions;
        const frames = yield* LiveFrames;
        const onTrack = (track: "room" | "stream") =>
          Effect.map(frames.current(organizationId, track), screen);

        const missing = yield* sessions
          .streamShowLines({ lines: ["x"], caption: null })
          .pipe(asActor(), Effect.flip);
        expect(missing._tag).toBe("NoLiveProject");

        yield* sessions.start(projectId).pipe(asActor());
        const shown = yield* sessions
          .streamShowLines({ lines: ["x", "y"], caption: "Refrain" })
          .pipe(asActor());
        expect(shown.session.streamOverride).toEqual({ lines: ["x", "y"], caption: "Refrain" });
        expect([yield* onTrack("room"), yield* onTrack("stream")]).toEqual(["A1", "x y"]);

        // Navigation stream : la sélection disparaît.
        yield* sessions.streamNext.pipe(asActor());
        expect(yield* onTrack("stream")).toBe("A1.2");

        // Lié : la salle change de diapo, la sélection disparaît aussi.
        yield* sessions.streamShowLines({ lines: ["x"], caption: null }).pipe(asActor());
        yield* sessions.setCover("stream", "black").pipe(asActor());
        expect(yield* onTrack("stream")).toBe("[black] x");
        yield* sessions.setCover("stream", "none").pipe(asActor());
        yield* sessions.next.pipe(asActor());
        expect(yield* onTrack("stream")).toBe("A2.1");

        // Délié : la salle avance sans toucher la sélection ; reprendre revient à la partie.
        yield* sessions.setStreamLinked(false).pipe(asActor());
        yield* sessions.streamShowLines({ lines: ["z"], caption: null }).pipe(asActor());
        yield* sessions.next.pipe(asActor());
        expect([yield* onTrack("room"), yield* onTrack("stream")]).toEqual(["C1", "z"]);
        const resumed = yield* sessions.streamResume.pipe(asActor());
        expect(resumed.session.streamOverride).toBeNull();
        expect(yield* onTrack("stream")).toBe("A2.1");
      }).pipe(
        Effect.provide(
          layerWith(makeDeckSource(deckOf([item(1, ["A1", "A2"], 2), item(3, ["C1"])]))),
        ),
      ),
  );

  it.effect("boutons d'urgence indépendants par piste", () =>
    Effect.gen(function* () {
      const sessions = yield* LiveSessions;
      const frames = yield* LiveFrames;
      const onTrack = (track: "room" | "stream") =>
        Effect.map(frames.current(organizationId, track), screen);

      yield* sessions.start(projectId).pipe(asActor());
      yield* sessions.setCover("room", "logo").pipe(asActor());
      const covered = yield* sessions.setCover("stream", "hideText").pipe(asActor());
      expect(covered.session).toMatchObject({ roomCover: "logo", streamCover: "hideText" });
      expect([yield* onTrack("room"), yield* onTrack("stream")]).toEqual([
        "[logo] A1",
        "[hideText] A1",
      ]);

      // Le contenu continue d'avancer sous le bouton d'urgence.
      yield* sessions.next.pipe(asActor());
      expect(yield* onTrack("room")).toBe("[logo] A2");
      yield* sessions.setCover("room", "none").pipe(asActor());
      expect([yield* onTrack("room"), yield* onTrack("stream")]).toEqual(["A2", "[hideText] A2"]);

      const stopped = yield* sessions.stop.pipe(asActor());
      expect(stopped.session).toMatchObject({ roomCover: "none", streamCover: "none" });
    }).pipe(Effect.provide(layerWith(makeDeckSource(baseDeck)))),
  );

  it.effect("publie les infos du retour scène : diapo suivante et minuteur", () =>
    Effect.gen(function* () {
      const sessions = yield* LiveSessions;
      const frames = yield* LiveFrames;
      const stageOf = Effect.map(frames.current(organizationId, "room"), (frame) => frame.stage);

      yield* sessions.start(projectId).pipe(asActor());
      expect(yield* stageOf).toMatchObject({
        next: { _tag: "Lines", lines: ["A2"] },
        notes: null,
        timer: { durationMs: 0, runningSince: null },
      });
      // La piste Stream ne transporte pas les infos du retour.
      expect((yield* frames.current(organizationId, "stream")).stage).toBeNull();

      yield* sessions.setTimer(60_000).pipe(asActor());
      const started = yield* sessions.startTimer.pipe(asActor());
      expect(started.session.timer.runningSince).not.toBeNull();
      expect((yield* stageOf)?.timer.durationMs).toBe(60_000);

      const paused = yield* sessions.pauseTimer.pipe(asActor());
      expect(paused.session.timer.runningSince).toBeNull();
      const reset = yield* sessions.resetTimer.pipe(asActor());
      expect(reset.session.timer).toEqual({ durationMs: 60_000, elapsedMs: 0, runningSince: null });

      // Dernière diapo : plus rien à annoncer.
      yield* sessions.goTo(itemId(3), 0).pipe(asActor());
      expect((yield* stageOf)?.next).toEqual({ _tag: "Blank" });
    }).pipe(Effect.provide(layerWith(makeDeckSource(baseDeck)))),
  );

  it.effect("édite une section en direct : bibliothèque, diffusion et signalement", () =>
    Effect.gen(function* () {
      const sessions = yield* LiveSessions;
      const frames = yield* LiveFrames;

      yield* sessions.start(projectId).pipe(asActor());
      const edited = yield* sessions
        .editSection(itemId(1), "verse-1", ["Nouvelle ligne"])
        .pipe(asActor());

      expect(songEditing.calls.at(-1)).toEqual({
        songId: "song-1",
        sectionId: "verse-1",
        lines: ["Nouvelle ligne"],
      });
      expect(edited.lastEdit).toMatchObject({ itemId: itemId(1), section: "verse-1" });
      // Le signalement ne survit pas à la commande suivante.
      expect((yield* sessions.next.pipe(asActor())).lastEdit).toBeNull();
      expect((yield* frames.current(organizationId, "room")).version).toBeGreaterThan(0);

      const unknown = yield* sessions
        .editSection(itemId(9), "verse-1", ["x"])
        .pipe(asActor(), Effect.flip);
      expect(unknown._tag).toBe("LiveEditFailed");
    }).pipe(Effect.provide(layerWith(makeDeckSource(baseDeck)))),
  );

  it.effect("pilote la lecture de la vidéo projetée", () =>
    Effect.gen(function* () {
      const sessions = yield* LiveSessions;
      const frames = yield* LiveFrames;
      const playbackOf = Effect.map(frames.current(organizationId, "room"), (frame) =>
        frame.content._tag === "Video" ? frame.content.playback : null,
      );

      yield* sessions.start(projectId).pipe(asActor());
      expect(yield* playbackOf).toMatchObject({ playing: false, positionMs: 0 });

      const playing = yield* sessions.playVideo.pipe(asActor());
      expect(playing.video.playing).toBe(true);
      expect((yield* playbackOf)?.since).not.toBeNull();

      const paused = yield* sessions.pauseVideo.pipe(asActor());
      expect(paused.video).toMatchObject({ playing: false, since: null });

      yield* sessions.playVideo.pipe(asActor());
      const restarted = yield* sessions.restartVideo.pipe(asActor());
      expect(restarted.video).toEqual({
        playing: false,
        positionMs: 0,
        since: null,
        durationMs: 0,
      });

      // Durée signalée par la régie, puis déplacement dans la vidéo.
      yield* sessions.setVideoDuration(30_000).pipe(asActor());
      const seeked = yield* sessions.seekVideo(12_000).pipe(asActor());
      expect(seeked.video).toMatchObject({ positionMs: 12_000, durationMs: 30_000 });
      // Un déplacement au-delà de la fin est ramené à la durée.
      expect((yield* sessions.seekVideo(99_000).pipe(asActor())).video.positionMs).toBe(30_000);

      // Changer de diapo arrête la vidéo.
      yield* sessions.playVideo.pipe(asActor());
      const moved = yield* sessions.next.pipe(asActor());
      expect(moved.video.playing).toBe(false);
    }).pipe(Effect.provide(layerWith(makeDeckSource(deckOf([videoItem(1), item(2, ["Suite"])]))))),
  );
});
