import { Layer } from "effect";

import { BibleHandlersLive } from "./api/handlers";
import { Bible } from "./application/Bible";
import { SqlScriptureRepository } from "./infrastructure/SqlScriptureRepository";

export { importTranslation } from "./infrastructure/ImportTranslation";
export { bibleMigrations } from "./migrations";

/** Handlers RPC du contexte bible (requiert `SqlClient` et `ActorMiddleware`). */
export const BibleLive = BibleHandlersLive.pipe(
  Layer.provide(Bible.layer),
  Layer.provide(SqlScriptureRepository),
);
