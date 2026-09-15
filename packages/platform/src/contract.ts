import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

export class HealthStatus extends Schema.Class<HealthStatus>("HealthStatus")({
  database: Schema.Literals(["up", "down"]),
}) {}

export const SystemRpcs = RpcGroup.make(Rpc.make("SystemHealth", { success: HealthStatus }));
