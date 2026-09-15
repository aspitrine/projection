import { Layer } from "effect";

import { SongsHandlersLive } from "./api/handlers";
import { Songs } from "./application/Songs";
import { SqlSongRepository } from "./infrastructure/SqlSongRepository";

export { Songs } from "./application/Songs";

export { songsMigrations } from "./migrations";

/** Cas d'usage du contexte, réutilisables par la composition root (ex. régie). */
export const SongsServiceLive = Songs.layer.pipe(Layer.provide(SqlSongRepository));

/** Handlers RPC du contexte songs (requiert `SqlClient` et `ActorMiddleware`). */
export const SongsLive = SongsHandlersLive.pipe(Layer.provide(SongsServiceLive));
