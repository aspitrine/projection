import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";

import { SystemRpcs } from "../src/contract";
import { DatabaseHealth } from "../src/DatabaseHealth";
import { SystemHandlersLive } from "../src/handlers";

const handlersWithDatabase = (up: boolean) =>
  SystemHandlersLive.pipe(
    Layer.provide(Layer.succeed(DatabaseHealth, DatabaseHealth.of({ check: Effect.succeed(up) }))),
  );

describe("SystemRpcs", () => {
  it.effect("SystemHealth signale une base joignable", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(SystemRpcs);
      const status = yield* client.SystemHealth();
      expect(status.database).toBe("up");
    }).pipe(Effect.provide(handlersWithDatabase(true))),
  );

  it.effect("SystemHealth signale une base injoignable", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(SystemRpcs);
      const status = yield* client.SystemHealth();
      expect(status.database).toBe("down");
    }).pipe(Effect.provide(handlersWithDatabase(false))),
  );
});
