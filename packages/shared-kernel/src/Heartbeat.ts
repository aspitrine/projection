import { type Duration, Effect, Ref, Stream } from "effect";

/**
 * Battement de cœur des flux temps réel.
 *
 * Une connexion peut mourir en silence (bascule Wi-Fi / 4G, coupure d'un
 * intermédiaire) : ni le serveur ni le navigateur ne reçoivent de fermeture, et
 * l'écran garde alors une image figée. Le serveur réémet donc la dernière valeur
 * à intervalle régulier, et le client abandonne un flux qui ne dit plus rien pour
 * se réabonner (l'état complet est renvoyé à chaque abonnement).
 */
export const HEARTBEAT_INTERVAL = "10 seconds";

/** Marge de trois battements : une seconde perdue ne coupe pas la diffusion. */
export const HEARTBEAT_TIMEOUT = "35 seconds";

/** Serveur : réémet la dernière valeur toutes les `interval`, tant que le flux vit. */
export const withHeartbeat = <A, E, R>(
  stream: Stream.Stream<A, E, R>,
  interval: Duration.Input = HEARTBEAT_INTERVAL,
): Stream.Stream<A, E, R> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const last = yield* Ref.make<A | undefined>(undefined);
      const beats = Stream.tick(interval).pipe(
        // `tick` bat immédiatement : ce premier battement ferait doublon avec la valeur en cours.
        Stream.drop(1),
        Stream.mapEffect(() => Ref.get(last)),
        Stream.flatMap((value) => (value === undefined ? Stream.empty : Stream.make(value))),
      );
      return stream.pipe(
        Stream.tap((value) => Ref.set(last, value)),
        // `left` : les battements s'arrêtent avec le flux qu'ils accompagnent.
        Stream.merge(beats, { haltStrategy: "left" }),
      );
    }),
  );

/** Client : coupe un flux silencieux pour que la reconnexion automatique reparte. */
export const withHeartbeatTimeout = <A, E, R>(
  stream: Stream.Stream<A, E, R>,
  timeout: Duration.Input = HEARTBEAT_TIMEOUT,
): Stream.Stream<A, E, R> => Stream.timeout(stream, timeout);
