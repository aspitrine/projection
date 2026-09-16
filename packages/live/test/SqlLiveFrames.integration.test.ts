import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import { runMigrations } from "@projection/platform";
import { OrganizationId } from "@projection/shared-kernel";
import { Config, Context, Effect, Layer, Queue, Stream } from "effect";

import { LiveFrames } from "../src/application/LiveFrames";
import { SqlLiveFrames } from "../src/infrastructure/SqlLiveFrames";
import { liveMigrations } from "../src/migrations";

/** Deux instances de l'application, chacune avec son propre pool, sur la même base. */
const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("TEST_DATABASE_URL") });

const MigratedDatabase = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* runMigrations([liveMigrations]);
    const sql = yield* PgClient.PgClient;
    // Nettoyage ciblé : les fichiers de test tournent en parallèle sur la même base.
    yield* sql`DELETE FROM live_frame WHERE organization_id = 'org-frames-multi'`;
  }),
).pipe(Layer.provideMerge(DatabaseLive));

const instance = SqlLiveFrames.pipe(Layer.provide(MigratedDatabase));

/** Démarre une instance complète (pool, écoute `LISTEN`) pour la durée du test. */
const startInstance = Effect.map(Layer.build(instance), (context) =>
  Context.get(context, LiveFrames),
);

const organizationId = OrganizationId.make("org-frames-multi");

const lines = (text: string) => ({ _tag: "Lines", lines: [text], caption: null }) as const;

describe.skipIf(!process.env.TEST_DATABASE_URL)("SqlLiveFrames (Postgres)", () => {
  it.effect(
    "une image publiée par une instance parvient aux écrans de l'autre",
    () =>
      Effect.gen(function* () {
        const first = yield* startInstance;
        const second = yield* startInstance;

        // Un écran branché sur la seconde instance.
        const received = yield* Queue.unbounded<string>();
        yield* second.watch(organizationId, "room").pipe(
          Stream.runForEach((frame) =>
            Queue.offer(
              received,
              frame.content._tag === "Lines" ? (frame.content.lines[0] ?? "") : "vide",
            ),
          ),
          Effect.forkChild,
        );
        expect(yield* Queue.take(received)).toBe("vide");

        yield* first.publish(organizationId, "room", lines("Gloire à Dieu"), "none", null);
        expect(yield* Queue.take(received)).toBe("Gloire à Dieu");

        // Et en sens inverse, avec un bouton d'urgence.
        yield* second.publish(organizationId, "room", lines("Alléluia"), "black", null);
        expect(yield* Queue.take(received)).toBe("Alléluia");
        expect((yield* first.current(organizationId, "room")).cover).toBe("black");
      }),
    { timeout: 20_000 },
  );

  it.effect(
    "les versions se suivent d'une instance à l'autre",
    () =>
      Effect.gen(function* () {
        const first = yield* startInstance;
        const second = yield* startInstance;

        const published = yield* first.publish(
          organizationId,
          "stream",
          lines("Première"),
          "none",
          null,
        );
        const next = yield* second.publish(
          organizationId,
          "stream",
          lines("Seconde"),
          "none",
          null,
        );
        expect(next.version).toBe(published.version + 1);
      }),
    { timeout: 20_000 },
  );
});
