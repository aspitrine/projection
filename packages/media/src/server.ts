import { Layer } from "effect";

import { MediaHandlersLive } from "./api/handlers";
import { Media } from "./application/Media";
import { SqlMediaRepository } from "./infrastructure/SqlMediaRepository";

export { Media } from "./application/Media";
export { MediaRepository, MediaStorage } from "./application/ports";
export { mediaMigrations } from "./migrations";

/** Cas d'usage des médias (requiert `SqlClient` et `MediaStorage`). */
export const MediaServiceLive = Media.layer.pipe(Layer.provide(SqlMediaRepository));

/** Handlers RPC du contexte media (requiert `SqlClient`, `MediaStorage`, `ActorMiddleware`). */
export const MediaLive = MediaHandlersLive.pipe(Layer.provide(MediaServiceLive));
