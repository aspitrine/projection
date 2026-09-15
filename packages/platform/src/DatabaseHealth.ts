import { Context, Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

export class DatabaseHealth extends Context.Service<
  DatabaseHealth,
  {
    readonly check: Effect.Effect<boolean>;
  }
>()("@projection/platform/DatabaseHealth") {
  static readonly layer = Layer.effect(
    DatabaseHealth,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const check = sql`SELECT 1`.pipe(
        Effect.timeout("2 seconds"),
        Effect.as(true),
        Effect.catchCause((cause) =>
          Effect.logWarning("Base de données injoignable", cause).pipe(Effect.as(false)),
        ),
        Effect.withSpan("DatabaseHealth.check"),
      );

      return DatabaseHealth.of({ check });
    }),
  );
}
