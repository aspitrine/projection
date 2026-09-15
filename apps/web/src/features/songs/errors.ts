import type { InvalidLyrics } from "@projection/songs/domain";
import { type Cause, Exit, Option } from "effect";
import { Cause as CauseModule } from "effect";

import { m } from "@/paraglide/messages";

export const lyricsErrorMessage = (error: InvalidLyrics) => {
  switch (error.reason) {
    case "Empty":
      return m.song_error_empty();
    case "DuplicateSection":
      return m.song_error_duplicate({ tag: error.tag ?? "" });
    case "UndefinedRepeat":
      return m.song_error_undefined_repeat({ tag: error.tag ?? "" });
  }
};

const messageFor = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "InvalidLyrics" &&
  "reason" in error
    ? lyricsErrorMessage(error as InvalidLyrics)
    : m.song_save_error();

/** Message d'erreur affichable pour une mutation de chant échouée. */
export const mutationErrorMessage = <A, E>(exit: Exit.Exit<A, E>) =>
  Option.match(Exit.findErrorOption(exit), {
    onNone: () => m.song_save_error(),
    onSome: messageFor,
  });

export const causeHasTag = <E>(cause: Cause.Cause<E>, tag: string) =>
  Option.match(CauseModule.findErrorOption(cause), {
    onNone: () => false,
    onSome: (error) =>
      typeof error === "object" && error !== null && "_tag" in error && error._tag === tag,
  });
