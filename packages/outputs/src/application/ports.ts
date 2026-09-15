import type { Frame, FrameContent, Track } from "@projection/presentation/domain";
import type { OrganizationId, OutputId } from "@projection/shared-kernel";
import { Context, Effect, Layer, Option, Ref, type Stream } from "effect";

import { type DisplayToken, Output, type SplittingSettings } from "../domain/Output";

export type RemoveResult = "Removed" | "NotFound" | "Last";

/** Port de persistance des sorties. */
export class OutputRepository extends Context.Service<
  OutputRepository,
  {
    list(organizationId: OrganizationId): Effect.Effect<ReadonlyArray<Output>>;
    /** Insère la sortie seulement si l'organisation n'en a aucune (atomique). */
    insertIfNone(output: Output): Effect.Effect<void>;
    insert(output: Output): Effect.Effect<void>;
    findById(organizationId: OrganizationId, id: OutputId): Effect.Effect<Option.Option<Output>>;
    findByToken(token: DisplayToken): Effect.Effect<Option.Option<Output>>;
    updateToken(
      organizationId: OrganizationId,
      id: OutputId,
      token: DisplayToken,
      now: number,
    ): Effect.Effect<Option.Option<Output>>;
    rename(
      organizationId: OrganizationId,
      id: OutputId,
      name: string,
      now: number,
    ): Effect.Effect<Option.Option<Output>>;
    /** Supprime la sortie, sauf si c'est la dernière de l'organisation (atomique). */
    remove(organizationId: OrganizationId, id: OutputId): Effect.Effect<RemoveResult>;
    splitting(organizationId: OrganizationId): Effect.Effect<Option.Option<SplittingSettings>>;
    saveSplitting(
      organizationId: OrganizationId,
      settings: SplittingSettings,
      now: number,
    ): Effect.Effect<void>;
  }
>()("@projection/outputs/OutputRepository") {
  static readonly layerMemory = Layer.effect(
    OutputRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make<ReadonlyArray<Output>>([]);
      const splittings = yield* Ref.make(new Map<OrganizationId, SplittingSettings>());
      const find = (predicate: (output: Output) => boolean) =>
        Ref.get(store).pipe(Effect.map((outputs) => Option.fromNullishOr(outputs.find(predicate))));

      const update = (
        organizationId: OrganizationId,
        id: OutputId,
        change: (output: Output) => Output,
      ) =>
        Ref.modify(store, (outputs) => {
          const current = outputs.find(
            (output) => output.id === id && output.organizationId === organizationId,
          );
          if (current === undefined) return [Option.none<Output>(), outputs] as const;
          const updated = change(current);
          return [
            Option.some(updated),
            outputs.map((output) => (output === current ? updated : output)),
          ] as const;
        });

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
        insert: (output) => Ref.update(store, (outputs) => [...outputs, output]),
        findById: (organizationId, id) =>
          find((output) => output.id === id && output.organizationId === organizationId),
        findByToken: (token) => find((output) => output.token === token),
        updateToken: (organizationId, id, token, now) =>
          update(organizationId, id, (output) => new Output({ ...output, token, updatedAt: now })),
        rename: (organizationId, id, name, now) =>
          update(organizationId, id, (output) => new Output({ ...output, name, updatedAt: now })),
        remove: (organizationId, id) =>
          Ref.modify(store, (outputs): readonly [RemoveResult, ReadonlyArray<Output>] => {
            const own = outputs.filter((output) => output.organizationId === organizationId);
            if (!own.some((output) => output.id === id)) return ["NotFound", outputs];
            if (own.length <= 1) return ["Last", outputs];
            return ["Removed", outputs.filter((output) => output.id !== id)];
          }),
        splitting: (organizationId) =>
          Ref.get(splittings).pipe(
            Effect.map((settings) => Option.fromNullishOr(settings.get(organizationId))),
          ),
        saveSplitting: (organizationId, settings) =>
          Ref.update(splittings, (current) => new Map(current).set(organizationId, settings)),
      });
    }),
  );
}

/** Port vers la diffusion en direct (implémenté par le contexte live). */
export class FrameGateway extends Context.Service<
  FrameGateway,
  {
    /** Image courante d'une piste puis chaque changement. */
    watch(organizationId: OrganizationId, track: Track): Stream.Stream<Frame>;
    /** Affiche un contenu sur toutes les pistes (test d'affichage). */
    show(organizationId: OrganizationId, content: FrameContent): Effect.Effect<void>;
  }
>()("@projection/outputs/FrameGateway") {}
