import type { Frame, FrameContent } from "@projection/presentation/domain";
import type { OrganizationId, OutputId } from "@projection/shared-kernel";
import { Context, Effect, Layer, Option, Ref, type Stream } from "effect";

import type { DisplayToken, Output } from "../domain/Output";

/** Port de persistance des sorties. */
export class OutputRepository extends Context.Service<
  OutputRepository,
  {
    list(organizationId: OrganizationId): Effect.Effect<ReadonlyArray<Output>>;
    /** Insère la sortie seulement si l'organisation n'en a aucune (atomique). */
    insertIfNone(output: Output): Effect.Effect<void>;
    findById(organizationId: OrganizationId, id: OutputId): Effect.Effect<Option.Option<Output>>;
    findByToken(token: DisplayToken): Effect.Effect<Option.Option<Output>>;
    updateToken(
      organizationId: OrganizationId,
      id: OutputId,
      token: DisplayToken,
      now: number,
    ): Effect.Effect<Option.Option<Output>>;
  }
>()("@projection/outputs/OutputRepository") {
  static readonly layerMemory = Layer.effect(
    OutputRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make<ReadonlyArray<Output>>([]);
      const find = (predicate: (output: Output) => boolean) =>
        Ref.get(store).pipe(Effect.map((outputs) => Option.fromNullishOr(outputs.find(predicate))));

      return OutputRepository.of({
        list: (organizationId) =>
          Ref.get(store).pipe(
            Effect.map((outputs) =>
              outputs.filter((output) => output.organizationId === organizationId),
            ),
          ),
        insertIfNone: (output) =>
          Ref.update(store, (outputs) =>
            outputs.some((existing) => existing.organizationId === output.organizationId)
              ? outputs
              : [...outputs, output],
          ),
        findById: (organizationId, id) =>
          find((output) => output.id === id && output.organizationId === organizationId),
        findByToken: (token) => find((output) => output.token === token),
        updateToken: (organizationId, id, token, now) =>
          Ref.modify(store, (outputs) => {
            const index = outputs.findIndex(
              (output) => output.id === id && output.organizationId === organizationId,
            );
            const current = outputs[index];
            if (current === undefined) return [Option.none(), outputs] as const;
            const updated = new (current.constructor as typeof Output)({
              ...current,
              token,
              updatedAt: now,
            });
            return [
              Option.some(updated),
              outputs.map((output, i) => (i === index ? updated : output)),
            ] as const;
          }),
      });
    }),
  );
}

/** Port vers la diffusion en direct (implémenté par le contexte live). */
export class FrameGateway extends Context.Service<
  FrameGateway,
  {
    watch(organizationId: OrganizationId): Stream.Stream<Frame>;
    show(organizationId: OrganizationId, content: FrameContent): Effect.Effect<Frame>;
  }
>()("@projection/outputs/FrameGateway") {}
