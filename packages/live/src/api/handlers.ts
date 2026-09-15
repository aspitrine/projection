import { Effect } from "effect";

import { LiveSessionStore } from "../application/LiveSessionStore";
import { LiveRpcs } from "./contract";

export const LiveHandlersLive = LiveRpcs.toLayer(
  Effect.gen(function* () {
    const store = yield* LiveSessionStore;

    return {
      LiveWatch: () => store.changes,
      LiveGoTo: ({ slideIndex }) => store.goTo(slideIndex),
      LiveToggleBlackout: () => store.toggleBlackout,
    };
  }),
);
