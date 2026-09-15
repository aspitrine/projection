import { Layer } from "effect";

import { LiveHandlersLive } from "./api/handlers";
import { LiveSessionStore } from "./application/LiveSessionStore";

export { LiveSessionStore } from "./application/LiveSessionStore";

export const LiveLive = LiveHandlersLive.pipe(Layer.provide(LiveSessionStore.layerMemory));
