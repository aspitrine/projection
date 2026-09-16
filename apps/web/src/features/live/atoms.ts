import { Effect, Schedule, Stream } from "effect";

import { ApiClient } from "@/api/client";

/** État de la régie ; réabonnement automatique après coupure (état complet renvoyé). */
export const liveAtom = ApiClient.runtime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const client = yield* ApiClient;
      return client("LiveWatch", undefined);
    }),
  ).pipe(Stream.retry(Schedule.spaced("1 second")), Stream.repeat(Schedule.spaced("1 second"))),
);

export const liveStartAtom = ApiClient.mutation("LiveStart");
export const liveGoToAtom = ApiClient.mutation("LiveGoTo");
export const liveNextAtom = ApiClient.mutation("LiveNext");
export const livePreviousAtom = ApiClient.mutation("LivePrevious");
export const liveSetCoverAtom = ApiClient.mutation("LiveSetCover");
export const liveRefreshAtom = ApiClient.mutation("LiveRefresh");
export const liveStopAtom = ApiClient.mutation("LiveStop");
export const liveStreamGoToAtom = ApiClient.mutation("LiveStreamGoTo");
export const liveStreamNextAtom = ApiClient.mutation("LiveStreamNext");
export const liveStreamPreviousAtom = ApiClient.mutation("LiveStreamPrevious");
export const liveStreamSetLinkedAtom = ApiClient.mutation("LiveStreamSetLinked");
export const liveStreamShowLinesAtom = ApiClient.mutation("LiveStreamShowLines");
export const liveStreamResumeAtom = ApiClient.mutation("LiveStreamResume");
export const liveTimerSetAtom = ApiClient.mutation("LiveTimerSet");
export const liveTimerStartAtom = ApiClient.mutation("LiveTimerStart");
export const liveTimerPauseAtom = ApiClient.mutation("LiveTimerPause");
export const liveTimerResetAtom = ApiClient.mutation("LiveTimerReset");
