import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { AtomRpc } from "effect/unstable/reactivity";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

import { ApiRpcs } from "./contract";

export class ApiClient extends AtomRpc.Service<ApiClient>()("web/ApiClient", {
  group: ApiRpcs,
  // Évalué à la première utilisation, donc dans le navigateur uniquement.
  protocol: () =>
    RpcClient.layerProtocolHttp({
      url: new URL("/api/rpc", window.location.origin).href,
    }).pipe(Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer])),
}) {}
