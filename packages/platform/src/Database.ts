import { PgClient } from "@effect/sql-pg";
import { Config } from "effect";

/** Client Postgres partagé (fournit `SqlClient` et `PgClient`). */
export const DatabaseLive = PgClient.layerConfig({
  url: Config.Redacted("DATABASE_URL"),
});
