import type { Frame, FrameContent, SlideTheme, Track } from "@projection/presentation/domain";
import type { OrganizationId, OutputId, ProjectId } from "@projection/shared-kernel";
import { Context, Effect, Layer, Option, Ref, type Stream } from "effect";

import {
  type Branding,
  type DisplayToken,
  Output,
  type SlideBackground,
  type SplittingSettings,
} from "../domain/Output";

export type RemoveResult = "Removed" | "NotFound" | "Last";

/** Port de persistance des sorties. */
export class OutputRepository extends Context.Service<
  OutputRepository,
  {
    list(
      organizationId: OrganizationId,
      projectId: ProjectId,
    ): Effect.Effect<ReadonlyArray<Output>>;
    /** Insère la sortie seulement si le projet n'en a aucune (atomique). */
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
    /** `null` remet le thème par défaut du type de sortie. */
    updateTheme(
      organizationId: OrganizationId,
      id: OutputId,
      theme: SlideTheme | null,
      now: number,
    ): Effect.Effect<Option.Option<Output>>;
    /** Supprime la sortie, sauf si c'est la dernière de son projet (atomique). */
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
        list: (organizationId, projectId) =>
          Ref.get(store).pipe(
            Effect.map((outputs) =>
              outputs.filter(
                (output) =>
                  output.organizationId === organizationId && output.projectId === projectId,
              ),
            ),
          ),
        insertIfNone: (output) =>
          Ref.update(store, (outputs) =>
            outputs.some(
              (existing) =>
                existing.organizationId === output.organizationId &&
                existing.projectId === output.projectId,
            )
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
        updateTheme: (organizationId, id, theme, now) =>
          update(organizationId, id, (output) => new Output({ ...output, theme, updatedAt: now })),
        remove: (organizationId, id) =>
          Ref.modify(store, (outputs): readonly [RemoveResult, ReadonlyArray<Output>] => {
            const target = outputs.find(
              (output) => output.id === id && output.organizationId === organizationId,
            );
            if (target === undefined) return ["NotFound", outputs];
            const own = outputs.filter(
              (output) =>
                output.organizationId === organizationId && output.projectId === target.projectId,
            );
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
    watch(
      organizationId: OrganizationId,
      projectId: ProjectId,
      track: Track,
    ): Stream.Stream<Frame>;
    /** Affiche un contenu sur toutes les pistes (test d'affichage). */
    show(
      organizationId: OrganizationId,
      projectId: ProjectId,
      content: FrameContent,
    ): Effect.Effect<void>;
  }
>()("@projection/outputs/FrameGateway") {}

/** Port : nom et logo de l'organisation (implémenté dans la composition root, contexte identity). */
export class BrandingSource extends Context.Service<
  BrandingSource,
  {
    get(organizationId: OrganizationId): Effect.Effect<Branding>;
  }
>()("@projection/outputs/BrandingSource") {}

/**
 * Port : résolution du fond d'un thème (implémenté dans la composition root, contexte media).
 * L'URL doit rester stable un moment — un écran qui la recevrait différente à chaque image
 * rechargerait son fond en boucle.
 */
export class ThemeBackgrounds extends Context.Service<
  ThemeBackgrounds,
  {
    resolve(
      organizationId: OrganizationId,
      mediaId: string,
    ): Effect.Effect<Option.Option<SlideBackground>>;
  }
>()("@projection/outputs/ThemeBackgrounds") {
  static readonly layerNone = Layer.succeed(
    ThemeBackgrounds,
    ThemeBackgrounds.of({ resolve: () => Effect.succeed(Option.none()) }),
  );
}
