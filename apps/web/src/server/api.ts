import { layerIdentity } from "@projection/identity/server";
import { LiveLive } from "@projection/live/server";
import {
  DatabaseHealth,
  DatabaseLive,
  LoggerLive,
  SystemHandlersLive,
  layerMigrations,
} from "@projection/platform";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";

import { ApiRpcs } from "../api/contract";
import { auth, ensureAuthSchema } from "../services";

const AuthMigrationsLive = Layer.effectDiscard(
  Effect.promise(ensureAuthSchema).pipe(Effect.withSpan("auth.migrations")),
);

const HandlersLive = Layer.mergeAll(SystemHandlersLive, LiveLive, layerIdentity(auth)).pipe(
  Layer.provide(DatabaseHealth.layer),
);

const ApiLive = RpcServer.layerHttp({
  group: ApiRpcs,
  path: "/api/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(RpcSerialization.layerNdjson),
  // Les migrations sont construites avant le serveur RPC.
  Layer.provide(Layer.mergeAll(AuthMigrationsLive, layerMigrations([]))),
  Layer.provide(DatabaseLive),
  Layer.provide(LoggerLive),
);

export const apiHandler = HttpRouter.toWebHandler(ApiLive);

if (import.meta.hot) {
  import.meta.hot.dispose(() => apiHandler.dispose());
}
