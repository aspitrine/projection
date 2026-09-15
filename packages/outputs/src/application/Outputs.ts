import { CurrentActor, type Forbidden, OutputId, requireRole } from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Option, Stream } from "effect";

import {
  DisplayFrame,
  InvalidDisplayToken,
  Output,
  OutputNotFound,
  generateDisplayToken,
  isDisplayToken,
} from "../domain/Output";
import { FrameGateway, OutputRepository } from "./ports";

/** Nom de la sortie créée par défaut pour chaque organisation. */
export const DEFAULT_OUTPUT_NAME = "Salle";

export class Outputs extends Context.Service<
  Outputs,
  {
    /** Sorties de l'organisation ; crée la sortie salle par défaut si besoin. */
    readonly list: Effect.Effect<ReadonlyArray<Output>, never, CurrentActor>;
    regenerateToken(id: OutputId): Effect.Effect<Output, OutputNotFound | Forbidden, CurrentActor>;
    /** Affiche le nom de la sortie sur tous les écrans de l'organisation (test). */
    identify(id: OutputId): Effect.Effect<void, OutputNotFound, CurrentActor>;
    /** Flux public d'un écran, authentifié par son token. */
    watchDisplay(token: string): Stream.Stream<DisplayFrame, InvalidDisplayToken>;
  }
>()("@projection/outputs/Outputs") {
  static readonly layer = Layer.effect(
    Outputs,
    Effect.gen(function* () {
      const repository = yield* OutputRepository;
      const gateway = yield* FrameGateway;

      const find = Effect.fn("Outputs.find")(function* (id: OutputId) {
        const actor = yield* CurrentActor;
        const output = yield* repository.findById(actor.organizationId, id);
        return yield* Option.match(output, {
          onNone: () => Effect.fail(new OutputNotFound({ id })),
          onSome: Effect.succeed,
        });
      });

      return Outputs.of({
        list: Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const now = yield* Clock.currentTimeMillis;
          yield* repository.insertIfNone(
            new Output({
              id: OutputId.make(crypto.randomUUID()),
              organizationId: actor.organizationId,
              name: DEFAULT_OUTPUT_NAME,
              type: "room",
              token: yield* generateDisplayToken,
              createdAt: now,
              updatedAt: now,
            }),
          );
          return yield* repository.list(actor.organizationId);
        }).pipe(Effect.withSpan("Outputs.list")),

        regenerateToken: Effect.fn("Outputs.regenerateToken")(function* (id: OutputId) {
          const actor = yield* requireRole("owner", "admin");
          const token = yield* generateDisplayToken;
          const now = yield* Clock.currentTimeMillis;
          const updated = yield* repository.updateToken(actor.organizationId, id, token, now);
          return yield* Option.match(updated, {
            onNone: () => Effect.fail(new OutputNotFound({ id })),
            onSome: Effect.succeed,
          });
        }),

        identify: Effect.fn("Outputs.identify")(function* (id: OutputId) {
          const output = yield* find(id);
          yield* gateway.show(output.organizationId, {
            _tag: "Lines",
            lines: [output.name],
            caption: null,
          });
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
              const { name, type, organizationId } = output.value;
              return gateway
                .watch(organizationId)
                .pipe(
                  Stream.map(
                    (frame) => new DisplayFrame({ outputName: name, outputType: type, frame }),
                  ),
                );
            }),
          ),
      });
    }),
  );
}
