import { Effect, Layer } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";

/**
 * Migrations d'un bounded context. Chaque contexte a sa propre table de suivi
 * (`<context>_migrations`), ce qui garde les séquences d'IDs indépendantes.
 */
export interface ContextMigrations {
  readonly context: string;
  readonly migrations: Record<string, Effect.Effect<void, unknown, SqlClient.SqlClient>>;
}

const migrate = Migrator.make({});

export const runMigrations = Effect.fn("runMigrations")(function* (
  contexts: ReadonlyArray<ContextMigrations>,
) {
  for (const { context, migrations } of contexts) {
    const applied = yield* migrate({
      loader: Migrator.fromRecord(migrations),
      table: `${context}_migrations`,
    });
    if (applied.length > 0) {
      yield* Effect.logInfo(
        `[${context}] migrations appliquées`,
        applied.map(([id, name]) => `${id}_${name}`),
      );
    }
  }
});

export const layerMigrations = (contexts: ReadonlyArray<ContextMigrations>) =>
  Layer.effectDiscard(runMigrations(contexts));
