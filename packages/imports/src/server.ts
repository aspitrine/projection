import { Layer } from "effect";

import { ImportsHandlersLive } from "./api/handlers";
import { Imports } from "./application/Imports";

export { Imports } from "./application/Imports";
export { ProjectLibrary, SongLibrary } from "./application/ports";

/** Handlers d'import (requiert `SongLibrary`, `ProjectLibrary` et `ActorMiddleware`). */
export const ImportsLive = ImportsHandlersLive.pipe(Layer.provide(Imports.layer));
