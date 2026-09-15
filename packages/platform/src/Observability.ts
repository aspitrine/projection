import { Config, Effect, Layer, Logger } from "effect";

/** Logs lisibles en développement, JSON en production. */
export const LoggerLive = Layer.unwrap(
  Effect.gen(function* () {
    const nodeEnv = yield* Config.String("NODE_ENV").pipe(Config.withDefault("development"));
    return Logger.layer([nodeEnv === "production" ? Logger.consoleJson : Logger.consolePretty()]);
  }),
);
