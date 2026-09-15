import { describe, expect, it } from "@effect/vitest";
import type { Frame } from "@projection/presentation/domain";
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
  organizationId,
  projectId,
} from "./support";

const layerWith = (source: ReturnType<typeof makeDeckSource>) =>
  LiveSessions.layer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(LiveSessionRepository.layerMemory, LiveFrames.layerMemory, source.layer),
    ),
  );

const screen = (frame: Frame) =>
  `${frame.blackout ? "[noir] " : ""}${frame.content._tag === "Lines" ? frame.content.lines.join(" ") : frame.content._tag}`;

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

      yield* sessions.setBlackout(true).pipe(asActor());
      expect(yield* onScreen).toBe("[noir] A2");
      const jumped = yield* sessions.goTo(itemId(3), 0).pipe(asActor());
      expect(yield* onScreen).toBe("[noir] C1");
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
          blackout: true,
          streamLinked: true,
          streamCursor: null,
          streamOverride: null,
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
      expect(screen(yield* frames.current(organizationId, "room"))).toBe("[noir] C1");
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

      yield* sessions.setBlackout(true).pipe(asActor());
      expect(yield* onTrack("stream")).toBe("[noir] A1.2");

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
        yield* sessions.setBlackout(true).pipe(asActor());
        expect(yield* onTrack("stream")).toBe("[noir] x");
        yield* sessions.setBlackout(false).pipe(asActor());
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
});
