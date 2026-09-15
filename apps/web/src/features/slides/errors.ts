import { Cause, Exit, Option } from "effect";

import { m } from "@/paraglide/messages";

const tagOf = (error: unknown) =>
  typeof error === "object" && error !== null && "_tag" in error ? error._tag : undefined;

export const slideMutationErrorMessage = <A, E>(exit: Exit.Exit<A, E>) =>
  Option.match(Exit.findErrorOption(exit), {
    onNone: () => m.slide_save_error(),
    onSome: (error) =>
      tagOf(error) === "EmptyTextSlide" ? m.slide_empty_content() : m.slide_save_error(),
  });

export const isNotFound = <E>(cause: Cause.Cause<E>) =>
  Option.match(Cause.findErrorOption(cause), {
    onNone: () => false,
    onSome: (error) => tagOf(error) === "TextSlideNotFound",
  });
