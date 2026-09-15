import { Effect, Layer } from "effect";

import { Outputs } from "../application/Outputs";
import { DisplayRpcs, OutputsRpcs } from "./contract";

const OutputsHandlersLive = OutputsRpcs.toLayer(
  Effect.gen(function* () {
    const outputs = yield* Outputs;
    return {
      OutputsList: () => outputs.list,
      OutputsCreate: (input) => outputs.create(input),
      OutputsRename: ({ id, name }) => outputs.rename(id, name),
      OutputsRemove: ({ id }) => outputs.remove(id),
      OutputsSplitting: () => outputs.splitting,
      OutputsUpdateSplitting: (settings) => outputs.updateSplitting(settings),
      OutputsRegenerateToken: ({ id }) => outputs.regenerateToken(id),
      OutputsIdentify: ({ id }) => outputs.identify(id),
    };
  }),
);

const DisplayHandlersLive = DisplayRpcs.toLayer(
  Effect.gen(function* () {
    const outputs = yield* Outputs;
    return {
      DisplayWatch: ({ token }) => outputs.watchDisplay(token),
    };
  }),
);

export const HandlersLive = Layer.mergeAll(OutputsHandlersLive, DisplayHandlersLive);
