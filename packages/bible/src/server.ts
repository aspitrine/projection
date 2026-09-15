import { Layer } from "effect";

import { BibleHandlersLive } from "./api/handlers";
import { Bible } from "./application/Bible";
import { SqlScriptureRepository } from "./infrastructure/SqlScriptureRepository";

export { Bible } from "./application/Bible";

export { importTranslation } from "./infrastructure/ImportTranslation";
export { bibleMigrations } from "./migrations";

/** Cas d'usage du contexte, réutilisables par la composition root (ex. régie). */
export const BibleServiceLive = Bible.layer.pipe(Layer.provide(SqlScriptureRepository));

/** Handlers RPC du contexte bible (requiert `SqlClient` et `ActorMiddleware`). */
export const BibleLive = BibleHandlersLive.pipe(Layer.provide(BibleServiceLive));
