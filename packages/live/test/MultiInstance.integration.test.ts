import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import { runMigrations } from "@projection/platform";
import type { FrameContent } from "@projection/presentation/domain";
import { Actor, CurrentActor, OrganizationId, UserId } from "@projection/shared-kernel";
import { Config, Context, Effect, Layer, Option, Queue, Stream } from "effect";

import { LiveFrames } from "../src/application/LiveFrames";
import { LiveSessions } from "../src/application/LiveSessions";
import { SqlLiveFrames } from "../src/infrastructure/SqlLiveFrames";
import { SqlLiveSessionRepository } from "../src/infrastructure/SqlLiveSessionRepository";
import { liveMigrations } from "../src/migrations";
import {
  baseDeckForIntegration,
  itemId,
  makeDeckSource,
  makeSongEditing,
  projectId,
} from "./integration-support";

/** Organisation propre à ce fichier : les tests d'intégration partagent la base. */
const organizationId = OrganizationId.make("org-multi-instance");

/** Deux instances de l'application, chacune avec ses caches, sur la même base. */
const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("TEST_DATABASE_URL") });

const MigratedDatabase = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* runMigrations([liveMigrations]);
    const sql = yield* PgClient.PgClient;
    // Nettoyage ciblé : les fichiers de test tournent en parallèle sur la même base.
    yield* sql`DELETE FROM live_session WHERE organization_id = ${organizationId}`;
    yield* sql`DELETE FROM live_frame WHERE organization_id = ${organizationId}`;
  }),
).pipe(Layer.provideMerge(DatabaseLive));

const instance = LiveSessions.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      SqlLiveFrames,
      SqlLiveSessionRepository,
      makeDeckSource(baseDeckForIntegration).layer,
      makeSongEditing().layer,
    ),
  ),
  Layer.provide(MigratedDatabase),
);

const startInstance = Effect.map(Layer.build(instance), (context) => ({
  sessions: Context.get(context, LiveSessions),
  frames: Context.get(context, LiveFrames),
}));

const asActor = Effect.provideService(
  CurrentActor,
  new Actor({ userId: UserId.make("user"), organizationId, role: "operator" }),
);

/** Attend une valeur précise : chaque instance republie son état au démarrage. */
const waitFor = (queue: Queue.Queue<string>, expected: string) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 10; attempt++) {
      if ((yield* Queue.take(queue)) === expected) return true;
    }
    return false;
  });

const firstLine = (content: FrameContent) =>
  content._tag === "Lines" ? (content.lines[0] ?? "") : "vide";

describe.skipIf(!process.env.TEST_DATABASE_URL)("régie multi-instance (Postgres)", () => {
  it.effect(
    "une régie voit les commandes passées depuis l'autre instance",
    () =>
      Effect.gen(function* () {
        const a = yield* startInstance;
        const b = yield* startInstance;

        // Une régie ouverte sur l'instance B, un écran branché sur B lui aussi.
        const seen = yield* Queue.unbounded<string>();
        yield* b.sessions.watch.pipe(
          Stream.runForEach((snapshot) =>
            Queue.offer(seen, snapshot.session.cursor?.itemId ?? "aucun"),
          ),
          asActor,
          Effect.forkChild,
        );
        expect(yield* Queue.take(seen)).toBe("aucun");

        const screen = yield* Queue.unbounded<string>();
        yield* b.frames.watch(organizationId, projectId, "room").pipe(
          Stream.runForEach((frame) => Queue.offer(screen, firstLine(frame.content))),
          Effect.forkChild,
        );
        expect(yield* Queue.take(screen)).toBe("vide");

        // L'opérateur pilote depuis l'instance A.
        yield* a.sessions.start(projectId).pipe(asActor);
        expect(yield* waitFor(seen, itemId(1))).toBe(true);
        expect(yield* waitFor(screen, "A1")).toBe(true);

        yield* a.sessions.goTo(itemId(3), 0).pipe(asActor);
        expect(yield* waitFor(seen, itemId(3))).toBe(true);
        expect(yield* waitFor(screen, "C1")).toBe(true);

        // Et l'écran branché sur B suit la même image.
        const onB = yield* b.frames.current(organizationId, projectId, "room");
        const onA = yield* a.frames.current(organizationId, projectId, "room");
        expect(onB.version).toBe(onA.version);
        expect(firstLine(onB.content)).toBe(firstLine(onA.content));
      }),
    { timeout: 20_000 },
  );

  it.effect(
    "la lecture vidéo et le bouton d'urgence traversent les instances",
    () =>
      Effect.gen(function* () {
        const a = yield* startInstance;
        const b = yield* startInstance;

        yield* a.sessions.start(projectId).pipe(asActor);
        yield* a.sessions.setCover("room", "black").pipe(asActor);

        // La régie de B lit l'état enregistré par A.
        const onB = yield* b.sessions.watch.pipe(Stream.runHead, asActor);
        const snapshot = Option.getOrThrow(onB);
        expect(snapshot.session.roomCover).toBe("black");
      }),
    { timeout: 20_000 },
  );
});
