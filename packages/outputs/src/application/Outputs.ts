import {
  CurrentActor,
  type Forbidden,
  OutputId,
  ProjectId,
  requireRole,
  withHeartbeat,
} from "@projection/shared-kernel";
import type { SlideTheme } from "@projection/presentation/domain";
import { Clock, Context, Effect, Layer, Option, Stream } from "effect";

import {
  DisplayFrame,
  InvalidDisplayToken,
  LastOutput,
  Output,
  OutputNotFound,
  type OutputType,
  type SlideBackground,
  type SplittingSettings,
  defaultSplittingSettings,
  generateDisplayToken,
  isDisplayToken,
  trackOf,
} from "../domain/Output";
import { defaultThemeFor } from "../domain/Themes";
import { BrandingSource, FrameGateway, OutputRepository, ThemeBackgrounds } from "./ports";

/** Nom de la sortie créée par défaut pour chaque organisation. */
export const DEFAULT_OUTPUT_NAME = "Salle";

export class Outputs extends Context.Service<
  Outputs,
  {
    /** Sorties de l'organisation ; crée la sortie salle par défaut si besoin. */
    list(projectId: ProjectId): Effect.Effect<ReadonlyArray<Output>, never, CurrentActor>;
    create(input: {
      readonly projectId: ProjectId;
      readonly name: string;
      readonly type: OutputType;
    }): Effect.Effect<Output, Forbidden, CurrentActor>;
    rename(
      id: OutputId,
      name: string,
    ): Effect.Effect<Output, OutputNotFound | Forbidden, CurrentActor>;
    /** Thème de la sortie ; `null` revient au thème par défaut de son type. */
    setTheme(
      id: OutputId,
      theme: SlideTheme | null,
    ): Effect.Effect<Output, OutputNotFound | Forbidden, CurrentActor>;
    remove(
      id: OutputId,
    ): Effect.Effect<void, OutputNotFound | LastOutput | Forbidden, CurrentActor>;
    regenerateToken(id: OutputId): Effect.Effect<Output, OutputNotFound | Forbidden, CurrentActor>;
    /** Affiche le nom de la sortie sur tous les écrans de l'organisation (test). */
    identify(id: OutputId): Effect.Effect<void, OutputNotFound, CurrentActor>;
    /** Découpage par piste (valeurs par défaut si jamais réglé). */
    readonly splitting: Effect.Effect<SplittingSettings, never, CurrentActor>;
    updateSplitting(
      settings: SplittingSettings,
    ): Effect.Effect<SplittingSettings, Forbidden, CurrentActor>;
    /** Flux public d'un écran, authentifié par son token. */
    watchDisplay(token: string): Stream.Stream<DisplayFrame, InvalidDisplayToken>;
  }
>()("@projection/outputs/Outputs") {
  static readonly layer = Layer.effect(
    Outputs,
    Effect.gen(function* () {
      const repository = yield* OutputRepository;
      const gateway = yield* FrameGateway;
      const brandingSource = yield* BrandingSource;
      const backgrounds = yield* ThemeBackgrounds;

      const orNotFound = (id: OutputId) =>
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new OutputNotFound({ id })),
            onSome: (output: Output) => Effect.succeed(output),
          }),
        );

      const newOutput = Effect.fnUntraced(function* (
        projectId: ProjectId,
        name: string,
        type: OutputType,
      ) {
        const actor = yield* CurrentActor;
        const now = yield* Clock.currentTimeMillis;
        return new Output({
          id: OutputId.make(crypto.randomUUID()),
          organizationId: actor.organizationId,
          projectId,
          name,
          type,
          token: yield* generateDisplayToken,
          theme: null,
          createdAt: now,
          updatedAt: now,
        });
      });

      return Outputs.of({
        list: (projectId) => Effect.gen(function* () {
          const actor = yield* CurrentActor;
          yield* repository.insertIfNone(
            yield* newOutput(projectId, DEFAULT_OUTPUT_NAME, "room"),
          );
          return yield* repository.list(actor.organizationId, projectId);
        }).pipe(Effect.withSpan("Outputs.list")),

        create: Effect.fn("Outputs.create")(function* (input) {
          yield* requireRole("owner", "admin");
          const output = yield* newOutput(input.projectId, input.name, input.type);
          yield* repository.insert(output);
          return output;
        }),

        rename: Effect.fn("Outputs.rename")(function* (id: OutputId, name: string) {
          const actor = yield* requireRole("owner", "admin");
          const now = yield* Clock.currentTimeMillis;
          return yield* repository.rename(actor.organizationId, id, name, now).pipe(orNotFound(id));
        }),

        setTheme: Effect.fn("Outputs.setTheme")(function* (id: OutputId, theme: SlideTheme | null) {
          const actor = yield* requireRole("owner", "admin");
          const now = yield* Clock.currentTimeMillis;
          return yield* repository
            .updateTheme(actor.organizationId, id, theme, now)
            .pipe(orNotFound(id));
        }),

        remove: Effect.fn("Outputs.remove")(function* (id: OutputId) {
          const actor = yield* requireRole("owner", "admin");
          const result = yield* repository.remove(actor.organizationId, id);
          if (result === "NotFound") return yield* new OutputNotFound({ id });
          if (result === "Last") return yield* new LastOutput({ id });
        }),

        regenerateToken: Effect.fn("Outputs.regenerateToken")(function* (id: OutputId) {
          const actor = yield* requireRole("owner", "admin");
          const token = yield* generateDisplayToken;
          const now = yield* Clock.currentTimeMillis;
          return yield* repository
            .updateToken(actor.organizationId, id, token, now)
            .pipe(orNotFound(id));
        }),

        identify: Effect.fn("Outputs.identify")(function* (id: OutputId) {
          const actor = yield* CurrentActor;
          const output = yield* repository.findById(actor.organizationId, id).pipe(orNotFound(id));
          yield* gateway.show(output.organizationId, output.projectId, {
            _tag: "Lines",
            lines: [output.name],
            caption: null,
          });
        }),

        splitting: Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const stored = yield* repository.splitting(actor.organizationId);
          return Option.getOrElse(stored, () => defaultSplittingSettings);
        }).pipe(Effect.withSpan("Outputs.splitting")),

        updateSplitting: Effect.fn("Outputs.updateSplitting")(function* (
          settings: SplittingSettings,
        ) {
          const actor = yield* requireRole("owner", "admin");
          const now = yield* Clock.currentTimeMillis;
          yield* repository.saveSplitting(actor.organizationId, settings, now);
          return settings;
        }),

        watchDisplay: (token) =>
          Stream.unwrap(
            Effect.gen(function* () {
              const output = isDisplayToken(token)
                ? yield* repository.findByToken(token)
                : Option.none<Output>();
              if (Option.isNone(output)) {
                return yield* new InvalidDisplayToken();
              }
              const connected = output.value;
              const branding = yield* brandingSource.get(connected.organizationId);
              const frames = gateway.watch(
                connected.organizationId,
                connected.projectId,
                trackOf(connected.type),
              ).pipe(
                // Nom et thème sont relus à chaque image : une sortie renommée ou
                // re-thématisée s'applique dès la diapo suivante, sans reconnexion.
                Stream.mapEffect((frame) =>
                  Effect.gen(function* () {
                    const latest = yield* repository.findByToken(connected.token);
                    const current = Option.getOrElse(latest, () => connected);
                    const theme = current.theme ?? defaultThemeFor(current.type);
                    const background =
                      theme.backgroundMediaId === null
                        ? Option.none<SlideBackground>()
                        : yield* backgrounds.resolve(
                            current.organizationId,
                            theme.backgroundMediaId,
                          );
                    return new DisplayFrame({
                      outputName: current.name,
                      outputType: current.type,
                      theme,
                      background: Option.getOrElse(background, () => null),
                      branding,
                      frame,
                    });
                  }),
                ),
              );
              // Battement de cœur : un écran silencieux se réabonne plutôt que de rester figé.
              return withHeartbeat(frames);
            }),
          ),
      });
    }),
  );
}
