import { Effect } from "effect";

import { Imports } from "../application/Imports";
import { ImportsRpcs } from "./contract";

/** Le contenu arrive en base64 : le décodage reste en bordure, le domaine lit des octets. */
const decodeBase64 = (content: string) => Uint8Array.from(Buffer.from(content, "base64"));

export const ImportsHandlersLive = ImportsRpcs.toLayer(
  Effect.gen(function* () {
    const imports = yield* Imports;

    return {
      ImportsVideoPsalm: ({ fileName, content }) =>
        imports.importVideoPsalm(fileName, decodeBase64(content)),
    };
  }),
);
