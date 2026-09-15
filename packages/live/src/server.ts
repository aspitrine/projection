import { Layer } from "effect";

import { LiveHandlersLive } from "./api/handlers";
import { LiveSessions } from "./application/LiveSessions";
import { SqlLiveSessionRepository } from "./infrastructure/SqlLiveSessionRepository";

export { LiveFrames } from "./application/LiveFrames";
export { DeckSource } from "./application/ports";
export { liveMigrations } from "./migrations";

/** Régie (requiert `SqlClient`, `LiveFrames`, `DeckSource` et `ActorMiddleware`). */
export const LiveLive = LiveHandlersLive.pipe(
  Layer.provide(LiveSessions.layer),
  Layer.provide(SqlLiveSessionRepository),
);
