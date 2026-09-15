import { Effect } from "effect";

import { TextSlides } from "../application/TextSlides";
import { SlidesRpcs } from "./contract";

export const SlidesHandlersLive = SlidesRpcs.toLayer(
  Effect.gen(function* () {
    const slides = yield* TextSlides;

    return {
      SlidesList: ({ search }) => slides.list(search),
      SlidesGet: ({ id }) => slides.get(id),
      SlidesCreate: (input) => slides.create(input),
      SlidesUpdate: ({ id, input }) => slides.update(id, input),
      SlidesDelete: ({ id }) => slides.remove(id),
    };
  }),
);
