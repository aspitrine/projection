import { Layer } from "effect";

import { SongsHandlersLive } from "./api/handlers";
import { Songs } from "./application/Songs";
import { SqlSongRepository } from "./infrastructure/SqlSongRepository";

export { songsMigrations } from "./migrations";

/** Handlers RPC du contexte songs (requiert `SqlClient` et `ActorMiddleware`). */
export const SongsLive = SongsHandlersLive.pipe(
  Layer.provide(Songs.layer),
  Layer.provide(SqlSongRepository),
);
