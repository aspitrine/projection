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
      const onScreen = Effect.map(frames.current(organizationId), screen);

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
      expect(screen(yield* frames.current(organizationId))).toBe("A2");

      editable.set(deckOf([item(4, ["D1"])]));
      const removed = yield* sessions.refresh.pipe(asActor());
      expect(removed.session.cursor).toBeNull();
      expect(screen(yield* frames.current(organizationId))).toBe("Blank");

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
      expect(screen(yield* frames.current(organizationId))).toBe("[noir] C1");
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
});
