import { describe, expect, it } from "@effect/vitest";
import { PgClient } from "@effect/sql-pg";
import { ActorMiddleware } from "@projection/identity/contract";
import { runMigrations } from "@projection/platform";
import { Actor, CurrentActor, OrganizationId, UserId } from "@projection/shared-kernel";
import { Config, Effect, Layer, Queue } from "effect";
import { RpcTest } from "effect/unstable/rpc";

import { DisplayRpcs, OutputsRpcs } from "../src/api/contract";
import { OutputsLive, outputsMigrations } from "../src/server";
import { FrameGatewayMemory } from "./support";

/** Tests fonctionnels de l'API outputs sur Postgres (TEST_DATABASE_URL). */
const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("TEST_DATABASE_URL") });

const MigratedDatabase = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* runMigrations([outputsMigrations]);
    const sql = yield* PgClient.PgClient;
    yield* sql`TRUNCATE output`;
  }),
).pipe(Layer.provideMerge(DatabaseLive));

/** L'organisation et le rôle sont lus dans les en-têtes de test. */
const FakeActorMiddleware = Layer.succeed(
  ActorMiddleware,
  ActorMiddleware.of((effect, { headers }) =>
    Effect.provideService(
      effect,
      CurrentActor,
      new Actor({
        userId: UserId.make("user"),
        organizationId: OrganizationId.make(headers["x-test-organization"] ?? "org-a"),
        role: headers["x-test-role"] === "operator" ? "operator" : "admin",
      }),
    ),
  ),
);

const ApiLive = Layer.mergeAll(OutputsLive, FakeActorMiddleware).pipe(
  Layer.provide(FrameGatewayMemory),
  Layer.provideMerge(MigratedDatabase),
);

describe.skipIf(!process.env.TEST_DATABASE_URL)("API outputs (Postgres)", () => {
  it.effect("des listes simultanées ne créent qu'une sortie par organisation", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(OutputsRpcs);
      const results = yield* Effect.all(
        Array.from({ length: 5 }, () => client.OutputsList()),
        { concurrency: "unbounded" },
      );
      expect(new Set(results.flat().map((output) => output.id)).size).toBe(1);
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("un écran se connecte par token ; régénérer invalide l'ancien lien", () =>
    Effect.gen(function* () {
      const outputs = yield* RpcTest.makeClient(OutputsRpcs);
      const display = yield* RpcTest.makeClient(DisplayRpcs);
      const [output] = yield* outputs.OutputsList();
      if (output === undefined) throw new Error("sortie manquante");

      const screen = yield* display.DisplayWatch({ token: output.token }, { asQueue: true });
      expect((yield* Queue.take(screen)).outputName).toBe("Salle");

      yield* outputs.OutputsIdentify({ id: output.id });
      const identified = yield* Queue.take(screen);
      expect(identified.frame.content).toEqual({ _tag: "Lines", lines: ["Salle"], caption: null });

      const forbidden = yield* outputs
        .OutputsRegenerateToken({ id: output.id }, { headers: { "x-test-role": "operator" } })
        .pipe(Effect.flip);
      expect(forbidden._tag).toBe("Forbidden");

      const regenerated = yield* outputs.OutputsRegenerateToken({ id: output.id });
      expect(regenerated.token).not.toBe(output.token);

      const stale = yield* display.DisplayWatch({ token: output.token }, { asQueue: true });
      const error = yield* Queue.take(stale).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "InvalidDisplayToken" });
    }).pipe(Effect.provide(ApiLive)),
  );
});
