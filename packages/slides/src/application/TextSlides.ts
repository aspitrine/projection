import { CurrentActor, TextSlideId } from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Option } from "effect";

import { hasVisibleContent } from "../domain/RichText";
import {
  EmptyTextSlide,
  TextSlide,
  type TextSlideInput,
  TextSlideNotFound,
  type TextSlideSummary,
} from "../domain/TextSlide";
import { TextSlideRepository } from "./TextSlideRepository";

const ensureContent = (source: string) =>
  hasVisibleContent(source) ? Effect.void : Effect.fail(new EmptyTextSlide());

/** Cas d'usage des diapos texte, dans l'organisation de l'acteur courant. */
export class TextSlides extends Context.Service<
  TextSlides,
  {
    list(
      search: string | null,
    ): Effect.Effect<ReadonlyArray<TextSlideSummary>, never, CurrentActor>;
    get(id: TextSlideId): Effect.Effect<TextSlide, TextSlideNotFound, CurrentActor>;
    create(input: TextSlideInput): Effect.Effect<TextSlide, EmptyTextSlide, CurrentActor>;
    update(
      id: TextSlideId,
      input: TextSlideInput,
    ): Effect.Effect<TextSlide, TextSlideNotFound | EmptyTextSlide, CurrentActor>;
    remove(id: TextSlideId): Effect.Effect<void, TextSlideNotFound, CurrentActor>;
  }
>()("@projection/slides/TextSlides") {
  static readonly layer = Layer.effect(
    TextSlides,
    Effect.gen(function* () {
      const repository = yield* TextSlideRepository;

      const get = Effect.fn("TextSlides.get")(function* (id: TextSlideId) {
        const actor = yield* CurrentActor;
        return yield* repository.findById(actor.organizationId, id).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new TextSlideNotFound({ id })),
              onSome: Effect.succeed,
            }),
          ),
        );
      });

      const create = Effect.fn("TextSlides.create")(function* (input: TextSlideInput) {
        const actor = yield* CurrentActor;
        yield* ensureContent(input.source);
        const now = yield* Clock.currentTimeMillis;
        const slide = new TextSlide({
          id: TextSlideId.make(crypto.randomUUID()),
          organizationId: actor.organizationId,
          title: input.title,
          source: input.source.trim(),
          createdAt: now,
          updatedAt: now,
        });
        yield* repository.save(slide);
        return slide;
      });

      const update = Effect.fn("TextSlides.update")(function* (
        id: TextSlideId,
        input: TextSlideInput,
      ) {
        const existing = yield* get(id);
        yield* ensureContent(input.source);
        const now = yield* Clock.currentTimeMillis;
        const slide = new TextSlide({
          ...existing,
          title: input.title,
          source: input.source.trim(),
          updatedAt: now,
        });
        yield* repository.save(slide);
        return slide;
      });

      const remove = Effect.fn("TextSlides.remove")(function* (id: TextSlideId) {
        const actor = yield* CurrentActor;
        if (!(yield* repository.delete(actor.organizationId, id))) {
          return yield* new TextSlideNotFound({ id });
        }
      });

      const list = Effect.fn("TextSlides.list")(function* (search: string | null) {
        const actor = yield* CurrentActor;
        const trimmed = search?.trim() ?? "";
        return yield* repository.list(actor.organizationId, trimmed === "" ? null : trimmed);
      });

      return TextSlides.of({ list, get, create, update, remove });
    }),
  );
}
