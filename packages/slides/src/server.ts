import { Layer } from "effect";

import { SlidesHandlersLive } from "./api/handlers";
import { TextSlides } from "./application/TextSlides";
import { SqlTextSlideRepository } from "./infrastructure/SqlTextSlideRepository";

export { slidesMigrations } from "./migrations";

/** Handlers RPC du contexte slides (requiert `SqlClient` et `ActorMiddleware`). */
export const SlidesLive = SlidesHandlersLive.pipe(
  Layer.provide(TextSlides.layer),
  Layer.provide(SqlTextSlideRepository),
);
