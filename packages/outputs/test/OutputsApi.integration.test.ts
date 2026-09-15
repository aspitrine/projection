import { describe, expect, it } from "@effect/vitest";
import { PgClient } from "@effect/sql-pg";
import { ActorMiddleware } from "@projection/identity/contract";
import { runMigrations } from "@projection/platform";
import { Actor, CurrentActor, OrganizationId, UserId } from "@projection/shared-kernel";
import { Config, Effect, Exit, Layer, Queue } from "effect";
import { RpcTest } from "effect/unstable/rpc";

import { DisplayRpcs, OutputsRpcs } from "../src/api/contract";
import { OutputsLive, outputsMigrations } from "../src/server";
import { BrandingSourceMemory, FrameGatewayMemory } from "./support";

/** Tests fonctionnels de l'API outputs sur Postgres (TEST_DATABASE_URL). */
const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("TEST_DATABASE_URL") });

const MigratedDatabase = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* runMigrations([outputsMigrations]);
    const sql = yield* PgClient.PgClient;
    yield* sql`TRUNCATE output, output_splitting`;
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
  Layer.provide(Layer.mergeAll(FrameGatewayMemory, BrandingSourceMemory)),
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

  it.effect("gère les sorties et le découpage ; garde toujours une sortie", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(OutputsRpcs);
      const organization = { headers: { "x-test-organization": "org-crud" } };
      const [room] = yield* client.OutputsList(undefined, organization);
      if (room === undefined) throw new Error("sortie manquante");

      const stream = yield* client.OutputsCreate({ name: "Stream", type: "stream" }, organization);
      const renamed = yield* client.OutputsRename(
        { id: stream.id, name: "Stream YouTube" },
        organization,
      );
      expect(renamed).toMatchObject({ name: "Stream YouTube", type: "stream" });

      const invalidName = yield* client
        .OutputsCreate({ name: "  ", type: "stage" }, organization)
        .pipe(Effect.exit);
      expect(Exit.isFailure(invalidName)).toBe(true);

      yield* client.OutputsRemove({ id: stream.id }, organization);
      const last = yield* client.OutputsRemove({ id: room.id }, organization).pipe(Effect.flip);
      expect(last._tag).toBe("LastOutput");
      expect(yield* client.OutputsList(undefined, organization)).toHaveLength(1);

      const settings = {
        room: { songMaxLines: 5, scriptureMaxCharacters: 280 },
        stream: { songMaxLines: 2, scriptureMaxCharacters: 120 },
      };
      yield* client.OutputsUpdateSplitting(settings, organization);
      yield* client.OutputsUpdateSplitting(
        { ...settings, room: { songMaxLines: 3, scriptureMaxCharacters: 280 } },
        organization,
      );
      expect((yield* client.OutputsSplitting(undefined, organization)).room.songMaxLines).toBe(3);

      const outOfRange = yield* client
        .OutputsUpdateSplitting(
          { ...settings, stream: { songMaxLines: 0, scriptureMaxCharacters: 120 } },
          organization,
        )
        .pipe(Effect.exit);
      expect(Exit.isFailure(outOfRange)).toBe(true);
    }).pipe(Effect.provide(ApiLive)),
  );
});
