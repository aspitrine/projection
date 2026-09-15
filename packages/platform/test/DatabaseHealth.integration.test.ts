import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { DatabaseLive } from "../src/Database";
import { DatabaseHealth } from "../src/DatabaseHealth";

// Nécessite Postgres : `bun run db:start` puis `DATABASE_URL=... bun run test`.
describe.skipIf(!process.env.DATABASE_URL)("DatabaseHealth (Postgres)", () => {
  it.effect("interroge la base réelle", () =>
    Effect.gen(function* () {
      const databaseHealth = yield* DatabaseHealth;
      expect(yield* databaseHealth.check).toBe(true);
    }).pipe(Effect.provide(DatabaseHealth.layer), Effect.provide(DatabaseLive)),
  );
});
