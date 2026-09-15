import { Layer } from "effect";

import { LiveHandlersLive } from "./api/handlers";
import { LiveSessionStore } from "./application/LiveSessionStore";

export { LiveFrames } from "./application/LiveFrames";
export { LiveSessionStore } from "./application/LiveSessionStore";

/** Spike T0.2 (page `/spike/live`), remplacé par la régie en T1.8. */
export const LiveLive = LiveHandlersLive.pipe(Layer.provide(LiveSessionStore.layerMemory));
