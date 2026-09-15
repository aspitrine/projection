import { Effect, Schedule, Stream } from "effect";

import { ApiClient } from "@/api/client";

/**
 * Dernier état live reçu, avec l'heure de réception (mesure de latence du spike).
 * Après une coupure ou une fin de flux, on se réabonne : le serveur renvoie
 * l'état complet, donc le client se resynchronise sans logique dédiée.
 */
export const liveStateAtom = ApiClient.runtime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const client = yield* ApiClient;
      // Le premier état de chaque abonnement est l'état courant, pas un changement.
      let initial = true;
      return client("LiveWatch", undefined).pipe(
        Stream.map((state) => {
          const event = { state, receivedAt: Date.now(), initial };
          initial = false;
          return event;
        }),
      );
    }),
  ).pipe(Stream.retry(Schedule.spaced("1 second")), Stream.repeat(Schedule.spaced("1 second"))),
);

export const goToAtom = ApiClient.mutation("LiveGoTo");

export const toggleBlackoutAtom = ApiClient.mutation("LiveToggleBlackout");
