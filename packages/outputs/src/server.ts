import { Layer } from "effect";

import { HandlersLive } from "./api/handlers";
import { Outputs } from "./application/Outputs";
import { SqlOutputRepository } from "./infrastructure/SqlOutputRepository";

export { Outputs } from "./application/Outputs";
export { BrandingSource, FrameGateway, OutputRepository } from "./application/ports";
export { outputsMigrations } from "./migrations";

/** Cas d'usage des sorties (requiert `PgClient` et `FrameGateway`). */
export const OutputsServiceLive = Outputs.layer.pipe(Layer.provide(SqlOutputRepository));

/** Handlers des sorties et des écrans (requiert `PgClient`, `FrameGateway`, `ActorMiddleware`). */
export const OutputsLive = HandlersLive.pipe(Layer.provide(OutputsServiceLive));
