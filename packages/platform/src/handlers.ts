import { Effect } from "effect";

import { HealthStatus, SystemRpcs } from "./contract";
import { DatabaseHealth } from "./DatabaseHealth";

export const SystemHandlersLive = SystemRpcs.toLayer(
  Effect.gen(function* () {
    const databaseHealth = yield* DatabaseHealth;

    return {
      SystemHealth: () =>
        databaseHealth.check.pipe(
          Effect.map((up) => new HealthStatus({ database: up ? "up" : "down" })),
        ),
    };
  }),
);
