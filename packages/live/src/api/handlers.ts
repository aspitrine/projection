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
      LiveStreamGoTo: ({ itemId, slideIndex, part }) =>
        sessions.streamGoTo(itemId, slideIndex, part),
      LiveStreamNext: () => sessions.streamNext,
      LiveStreamPrevious: () => sessions.streamPrevious,
      LiveStreamSetLinked: ({ linked }) => sessions.setStreamLinked(linked),
      LiveStreamShowLines: ({ lines, caption }) => sessions.streamShowLines({ lines, caption }),
      LiveStreamResume: () => sessions.streamResume,
      LiveRefresh: () => sessions.refresh,
      LiveStop: () => sessions.stop,
    };
  }),
);
