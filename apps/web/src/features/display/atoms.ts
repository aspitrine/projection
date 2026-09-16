import type { DisplayFrame } from "@projection/outputs/domain";
import { withHeartbeatTimeout } from "@projection/shared-kernel";
import { Effect, Schedule, Stream } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { ApiClient } from "@/api/client";

export type DisplayEvent =
  | { readonly _tag: "Frame"; readonly display: DisplayFrame }
  | { readonly _tag: "InvalidToken" };

/**
 * Flux d'un écran. Token invalide : on l'indique puis on réessaie lentement (le lien
 * peut avoir été régénéré puis rétabli). Coupure réseau : reconnexion rapide, et
 * l'état complet est renvoyé à chaque (ré)abonnement. Un flux qui ne bat plus est
 * abandonné, faute de quoi l'écran garderait indéfiniment une image figée.
 */
export const displayAtom = Atom.family((token: string) =>
  ApiClient.runtime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ApiClient;
        return client("DisplayWatch", { token });
      }),
    ).pipe(
      withHeartbeatTimeout,
      Stream.map((display): DisplayEvent => ({ _tag: "Frame", display })),
      Stream.catchTag("InvalidDisplayToken", () =>
        Stream.make({ _tag: "InvalidToken" } as DisplayEvent).pipe(
          Stream.concat(Stream.fromEffect(Effect.sleep("10 seconds")).pipe(Stream.drain)),
        ),
      ),
      Stream.retry(Schedule.spaced("1 second")),
      Stream.repeat(Schedule.spaced("1 second")),
    ),
  ),
);
