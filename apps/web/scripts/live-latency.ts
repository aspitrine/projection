/**
 * Spike T0.2 — mesure la latence mutation → événement reçu par un abonné.
 * Usage : bun apps/web/scripts/live-latency.ts [url] [itérations]
 */
import { LiveRpcs } from "@projection/live/contract";
import { Effect, Layer, Queue } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

const url = process.argv[2] ?? "http://localhost:3001/api/rpc";
const iterations = Number(process.argv[3] ?? 50);

const ProtocolLive = RpcClient.layerProtocolHttp({ url }).pipe(
  Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer]),
);

const percentile = (sorted: ReadonlyArray<number>, p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? Number.NaN;

const program = Effect.gen(function* () {
  const watcher = yield* RpcClient.make(LiveRpcs);
  const mutator = yield* RpcClient.make(LiveRpcs);

  const watch = yield* watcher.LiveWatch(undefined, { asQueue: true });
  const initial = yield* Queue.take(watch);

  const samples: Array<number> = [];
  for (let i = 1; i <= iterations; i++) {
    const start = performance.now();
    const updated = yield* mutator.LiveGoTo({ slideIndex: initial.slideIndex + i });
    let received = yield* Queue.take(watch);
    while (received.version < updated.version) {
      received = yield* Queue.take(watch);
    }
    samples.push(performance.now() - start);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  yield* Effect.logInfo(
    `${iterations} mutations — p50 ${percentile(sorted, 50).toFixed(1)} ms, p95 ${percentile(sorted, 95).toFixed(1)} ms, max ${sorted.at(-1)?.toFixed(1)} ms`,
  );
}).pipe(Effect.scoped, Effect.provide(ProtocolLive));

Effect.runPromise(program);
