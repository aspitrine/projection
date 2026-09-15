import { describe, expect, it } from "@effect/vitest";
import { PgClient } from "@effect/sql-pg";
import { ActorMiddleware } from "@projection/identity/contract";
import { runMigrations } from "@projection/platform";
import { Actor, CurrentActor, UserId } from "@projection/shared-kernel";
import { Config, Effect, Layer, Option } from "effect";
import { RpcTest } from "effect/unstable/rpc";

import { LiveRpcs } from "../src/api/contract";
import { LiveSessionRepository } from "../src/application/ports";
import { SqlLiveSessionRepository } from "../src/infrastructure/SqlLiveSessionRepository";
import { LiveFrames, LiveLive, liveMigrations } from "../src/server";
import {
  baseDeckForIntegration,
  itemId,
  makeDeckSource,
  organizationId,
  projectId,
} from "./integration-support";

/** Tests fonctionnels de la régie sur Postgres (TEST_DATABASE_URL). */
const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("TEST_DATABASE_URL") });

const MigratedDatabase = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* runMigrations([liveMigrations]);
    const sql = yield* PgClient.PgClient;
    yield* sql`TRUNCATE live_session`;
  }),
).pipe(Layer.provideMerge(DatabaseLive));

const FakeActorMiddleware = Layer.succeed(
  ActorMiddleware,
  ActorMiddleware.of((effect) =>
    Effect.provideService(
      effect,
      CurrentActor,
      new Actor({ userId: UserId.make("user"), organizationId, role: "operator" }),
    ),
  ),
);

const source = makeDeckSource(baseDeckForIntegration);

const ApiLive = Layer.mergeAll(LiveLive, FakeActorMiddleware, SqlLiveSessionRepository).pipe(
  Layer.provideMerge(Layer.mergeAll(LiveFrames.layerMemory, source.layer)),
  Layer.provideMerge(MigratedDatabase),
);

describe.skipIf(!process.env.TEST_DATABASE_URL)("API live (Postgres)", () => {
  it.effect("pilote la diffusion et persiste la session", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(LiveRpcs);
      const frames = yield* LiveFrames;
      const repository = yield* LiveSessionRepository;

      yield* client.LiveStart({ projectId });
      yield* client.LiveNext();
      yield* client.LiveSetBlackout({ blackout: true });
      const snapshot = yield* client.LiveGoTo({ itemId: itemId(3), slideIndex: 0 });
      expect(snapshot.session).toMatchObject({ blackout: true, version: 4 });

      const frame = yield* frames.current(organizationId, "room");
      expect(frame).toMatchObject({ blackout: true, content: { _tag: "Lines", lines: ["C1"] } });

      const stored = yield* repository.load(organizationId);
      expect(Option.getOrNull(stored)).toMatchObject({
        projectId,
        blackout: true,
        version: 4,
        cursor: { itemId: itemId(3), slideIndex: 0 },
      });

      const error = yield* client.LiveGoTo({ itemId: itemId(2), slideIndex: 0 }).pipe(Effect.flip);
      expect(error._tag).toBe("LiveItemNotFound");

      yield* client.LiveStreamSetLinked({ linked: false });
      yield* client.LiveStreamGoTo({ itemId: itemId(1), slideIndex: 1, part: 0 });
      expect(Option.getOrNull(yield* repository.load(organizationId))).toMatchObject({
        streamLinked: false,
        streamCursor: { itemId: itemId(1), slideIndex: 1, part: 0 },
      });
      expect((yield* frames.current(organizationId, "stream")).content).toEqual({
        _tag: "Lines",
        lines: ["A2"],
        caption: null,
      });

      yield* client.LiveStop();
      expect(Option.getOrNull(yield* repository.load(organizationId))).toMatchObject({
        projectId: null,
        cursor: null,
        streamLinked: true,
        version: 7,
      });
    }).pipe(Effect.provide(ApiLive)),
  );
});
