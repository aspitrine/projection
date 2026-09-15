import type { OrganizationId, TextSlideId } from "@projection/shared-kernel";
import { Context, Effect, Layer, Option, Ref } from "effect";

import { type TextSlide, TextSlideSummary } from "../domain/TextSlide";

/** Port de persistance, limité à une organisation. */
export class TextSlideRepository extends Context.Service<
  TextSlideRepository,
  {
    list(
      organizationId: OrganizationId,
      search: string | null,
    ): Effect.Effect<ReadonlyArray<TextSlideSummary>>;
    findById(
      organizationId: OrganizationId,
      id: TextSlideId,
    ): Effect.Effect<Option.Option<TextSlide>>;
    save(slide: TextSlide): Effect.Effect<void>;
    delete(organizationId: OrganizationId, id: TextSlideId): Effect.Effect<boolean>;
  }
>()("@projection/slides/TextSlideRepository") {
  /** Implémentation en mémoire pour les tests d'application. */
  static readonly layerMemory = Layer.effect(
    TextSlideRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<TextSlideId, TextSlide>());
      const normalize = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase();

      return TextSlideRepository.of({
        list: (organizationId, search) =>
          Ref.get(store).pipe(
            Effect.map((slides) =>
              [...slides.values()]
                .filter((slide) => slide.organizationId === organizationId)
                .filter(
                  (slide) => search === null || normalize(slide.title).includes(normalize(search)),
                )
                .sort((a, b) => a.title.localeCompare(b.title))
                .map(
                  (slide) =>
                    new TextSlideSummary({
                      id: slide.id,
                      title: slide.title,
                      updatedAt: slide.updatedAt,
                    }),
                ),
            ),
          ),
        findById: (organizationId, id) =>
          Ref.get(store).pipe(
            Effect.map((slides) =>
              Option.fromNullishOr(slides.get(id)).pipe(
                Option.filter((slide) => slide.organizationId === organizationId),
              ),
            ),
          ),
        save: (slide) => Ref.update(store, (slides) => new Map(slides).set(slide.id, slide)),
        delete: (organizationId, id) =>
          Ref.modify(store, (slides) => {
            const slide = slides.get(id);
            if (slide === undefined || slide.organizationId !== organizationId) {
              return [false, slides] as const;
            }
            const next = new Map(slides);
            next.delete(id);
            return [true, next] as const;
          }),
      });
    }),
  );
}
