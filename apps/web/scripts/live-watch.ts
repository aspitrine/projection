/**
 * Spike T0.2 — garde un abonnement LiveWatch ouvert et journalise les fins de
 * flux, erreurs et reconnexions (vérifie les timeouts HTTP côté serveur).
 * Usage : bun apps/web/scripts/live-watch.ts [url] [durée en secondes]
 */
import { LiveRpcs } from "@projection/live/contract";
import { Duration, Effect, Layer, Schedule, Stream } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

const url = process.argv[2] ?? "http://localhost:3001/api/rpc";
const seconds = Number(process.argv[3] ?? 360);

const ProtocolLive = RpcClient.layerProtocolHttp({ url }).pipe(
  Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer]),
);

const startedAt = Date.now();
const elapsed = () => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;

const program = Effect.gen(function* () {
  const client = yield* RpcClient.make(LiveRpcs);
  let subscriptions = 0;

  yield* Stream.unwrap(
    Effect.sync(() => {
      subscriptions++;
      console.log(`[${elapsed()}] abonnement #${subscriptions}`);
      return client.LiveWatch();
    }),
  ).pipe(
    Stream.tap((state) =>
      Effect.sync(() =>
        console.log(`[${elapsed()}] état v${state.version} diapo ${state.slideIndex}`),
      ),
    ),
    Stream.onEnd(Effect.sync(() => console.log(`[${elapsed()}] fin de flux`))),
    Stream.tapError((error) =>
      Effect.sync(() => console.log(`[${elapsed()}] erreur : ${error._tag}`)),
    ),
    Stream.retry(Schedule.spaced("1 second")),
    Stream.repeat(Schedule.spaced("1 second")),
    Stream.runDrain,
    Effect.timeout(Duration.seconds(seconds)),
    Effect.ignore,
  );

  console.log(`[${elapsed()}] terminé après ${subscriptions} abonnement(s)`);
}).pipe(Effect.scoped, Effect.provide(ProtocolLive));

Effect.runPromise(program);
