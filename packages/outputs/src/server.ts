import { Layer } from "effect";

import { HandlersLive } from "./api/handlers";
import { Outputs } from "./application/Outputs";
import { SqlOutputRepository } from "./infrastructure/SqlOutputRepository";

export { FrameGateway } from "./application/ports";
export { outputsMigrations } from "./migrations";

/** Handlers des sorties et des écrans (requiert `PgClient`, `FrameGateway`, `ActorMiddleware`). */
export const OutputsLive = HandlersLive.pipe(
  Layer.provide(Outputs.layer),
  Layer.provide(SqlOutputRepository),
);
