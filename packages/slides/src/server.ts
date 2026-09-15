import { Layer } from "effect";

import { SlidesHandlersLive } from "./api/handlers";
import { TextSlides } from "./application/TextSlides";
import { SqlTextSlideRepository } from "./infrastructure/SqlTextSlideRepository";

export { TextSlides } from "./application/TextSlides";

export { slidesMigrations } from "./migrations";

/** Cas d'usage du contexte, réutilisables par la composition root (ex. régie). */
export const TextSlidesServiceLive = TextSlides.layer.pipe(Layer.provide(SqlTextSlideRepository));

/** Handlers RPC du contexte slides (requiert `SqlClient` et `ActorMiddleware`). */
export const SlidesLive = SlidesHandlersLive.pipe(Layer.provide(TextSlidesServiceLive));
