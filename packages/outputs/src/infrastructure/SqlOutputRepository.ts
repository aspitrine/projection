import { PgClient } from "@effect/sql-pg";
import { OrganizationId, OutputId } from "@projection/shared-kernel";
import { Effect, Layer, Schema } from "effect";
import { SqlSchema } from "effect/unstable/sql";

import { OutputRepository } from "../application/ports";
import { DisplayToken, Output } from "../domain/Output";

export const SqlOutputRepository = Layer.effect(
  OutputRepository,
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient;

    const columns = sql`
      id::text AS "id", organization_id AS "organizationId", name, type, token,
      (extract(epoch FROM created_at) * 1000)::float8 AS "createdAt",
      (extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt"
    `;

    const list = SqlSchema.findAll({
      Request: OrganizationId,
      Result: Output,
      execute: (organizationId) =>
        sql`SELECT ${columns} FROM output WHERE organization_id = ${organizationId} ORDER BY created_at, id`,
    });

    const findById = SqlSchema.findOneOption({
      Request: Schema.Struct({ organizationId: OrganizationId, id: OutputId }),
      Result: Output,
      execute: ({ organizationId, id }) =>
        sql`SELECT ${columns} FROM output WHERE id = ${id}::uuid AND organization_id = ${organizationId}`,
    });

    const findByToken = SqlSchema.findOneOption({
      Request: DisplayToken,
      Result: Output,
      execute: (token) => sql`SELECT ${columns} FROM output WHERE token = ${token}`,
    });

    const updateToken = SqlSchema.findOneOption({
      Request: Schema.Struct({
        organizationId: OrganizationId,
        id: OutputId,
        token: DisplayToken,
        now: Schema.Number,
      }),
      Result: Output,
      execute: ({ organizationId, id, token, now }) => sql`
        UPDATE output SET token = ${token}, updated_at = ${new Date(now)}
        WHERE id = ${id}::uuid AND organization_id = ${organizationId}
        RETURNING ${columns}
      `,
    });

    return OutputRepository.of({
      list: (organizationId) =>
        list(organizationId).pipe(Effect.orDie, Effect.withSpan("SqlOutputRepository.list")),

      insertIfNone: (output) =>
        Effect.gen(function* () {
          // Verrou par organisation : deux listes simultanées ne créent qu'une sortie.
          yield* sql`SELECT pg_advisory_xact_lock(hashtext(${`output:${output.organizationId}`}))`;
          yield* sql`
            INSERT INTO output (id, organization_id, name, type, token, created_at, updated_at)
            SELECT ${output.id}::uuid, ${output.organizationId}, ${output.name}, ${output.type},
                   ${output.token}, ${new Date(output.createdAt)}, ${new Date(output.updatedAt)}
            WHERE NOT EXISTS (SELECT 1 FROM output WHERE organization_id = ${output.organizationId})
          `;
        }).pipe(
          sql.withTransaction,
          Effect.orDie,
          Effect.withSpan("SqlOutputRepository.insertIfNone"),
        ),

      findById: (organizationId, id) =>
        findById({ organizationId, id }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlOutputRepository.findById"),
        ),

      findByToken: (token) =>
        findByToken(token).pipe(Effect.orDie, Effect.withSpan("SqlOutputRepository.findByToken")),

      updateToken: (organizationId, id, token, now) =>
        updateToken({ organizationId, id, token, now }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlOutputRepository.updateToken"),
        ),
    });
  }),
);
