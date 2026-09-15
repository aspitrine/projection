import { Branding } from "@projection/outputs/domain";
import { BrandingSource } from "@projection/outputs/server";
import { Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

/** Nom et logo de l'organisation, lus dans la table `organization` de better-auth. */
export const BrandingSourceLive = Layer.effect(
  BrandingSource,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const find = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: Branding,
      execute: (organizationId) =>
        sql`SELECT name, logo AS "logoUrl" FROM organization WHERE id = ${organizationId}`,
    });

    return BrandingSource.of({
      get: (organizationId) =>
        find(organizationId).pipe(
          Effect.map(Option.getOrElse(() => ({ name: "", logoUrl: null }))),
          Effect.orDie,
          Effect.withSpan("BrandingSource.get"),
        ),
    });
  }),
);
