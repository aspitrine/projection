import { Effect } from "effect";

import { LiveSessions } from "../application/LiveSessions";
import { LiveRpcs } from "./contract";

export const LiveHandlersLive = LiveRpcs.toLayer(
  Effect.gen(function* () {
    const sessions = yield* LiveSessions;

    return {
      LiveWatch: () => sessions.watch,
      LiveStart: ({ projectId }) => sessions.start(projectId),
      LiveGoTo: ({ itemId, slideIndex }) => sessions.goTo(itemId, slideIndex),
      LiveNext: () => sessions.next,
      LivePrevious: () => sessions.previous,
      LiveSetBlackout: ({ blackout }) => sessions.setBlackout(blackout),
      LiveRefresh: () => sessions.refresh,
      LiveStop: () => sessions.stop,
    };
  }),
);
