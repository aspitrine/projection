import { PgClient } from "@effect/sql-pg";
import { OrganizationId, OutputId } from "@projection/shared-kernel";
import { Effect, Layer, Schema } from "effect";
import { SqlSchema } from "effect/unstable/sql";

import { OutputRepository, type RemoveResult } from "../application/ports";
import { DisplayToken, Output, SplittingSettings } from "../domain/Output";

export const SqlOutputRepository = Layer.effect(
  OutputRepository,
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient;

    const columns = sql`
      id::text AS "id", organization_id AS "organizationId", name, type, token,
      (extract(epoch FROM created_at) * 1000)::float8 AS "createdAt",
      (extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt"
    `;

    /** Verrou par organisation : sérialise créations par défaut et suppressions. */
    const lockOrganization = (organizationId: OrganizationId) =>
      sql`SELECT pg_advisory_xact_lock(hashtext(${`output:${organizationId}`}))`;

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

    const rename = SqlSchema.findOneOption({
      Request: Schema.Struct({
        organizationId: OrganizationId,
        id: OutputId,
        name: Schema.String,
        now: Schema.Number,
      }),
      Result: Output,
      execute: ({ organizationId, id, name, now }) => sql`
        UPDATE output SET name = ${name}, updated_at = ${new Date(now)}
        WHERE id = ${id}::uuid AND organization_id = ${organizationId}
        RETURNING ${columns}
      `,
    });

    const splitting = SqlSchema.findOneOption({
      Request: OrganizationId,
      Result: SplittingSettings,
      execute: (organizationId) =>
        sql`SELECT room, stream FROM output_splitting WHERE organization_id = ${organizationId}`,
    });

    return OutputRepository.of({
      list: (organizationId) =>
        list(organizationId).pipe(Effect.orDie, Effect.withSpan("SqlOutputRepository.list")),

      insertIfNone: (output) =>
        Effect.gen(function* () {
          yield* lockOrganization(output.organizationId);
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

      insert: (output) =>
        sql`
          INSERT INTO output (id, organization_id, name, type, token, created_at, updated_at)
          VALUES (${output.id}::uuid, ${output.organizationId}, ${output.name}, ${output.type},
                  ${output.token}, ${new Date(output.createdAt)}, ${new Date(output.updatedAt)})
        `.pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("SqlOutputRepository.insert")),

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

      rename: (organizationId, id, name, now) =>
        rename({ organizationId, id, name, now }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlOutputRepository.rename"),
        ),

      remove: (organizationId, id) =>
        Effect.gen(function* () {
          yield* lockOrganization(organizationId);
          const rows = yield* sql<{ readonly id: string }>`
            SELECT id::text AS id FROM output WHERE organization_id = ${organizationId}
          `;
          if (!rows.some((row) => row.id === id)) return "NotFound" as RemoveResult;
          if (rows.length <= 1) return "Last" as RemoveResult;
          yield* sql`DELETE FROM output WHERE id = ${id}::uuid AND organization_id = ${organizationId}`;
          return "Removed" as RemoveResult;
        }).pipe(sql.withTransaction, Effect.orDie, Effect.withSpan("SqlOutputRepository.remove")),

      splitting: (organizationId) =>
        splitting(organizationId).pipe(
          Effect.orDie,
          Effect.withSpan("SqlOutputRepository.splitting"),
        ),

      saveSplitting: (organizationId, settings, now) =>
        sql`
          INSERT INTO output_splitting (organization_id, room, stream, updated_at)
          VALUES (${organizationId}, ${sql.json(settings.room)}, ${sql.json(settings.stream)}, ${new Date(now)})
          ON CONFLICT (organization_id) DO UPDATE SET
            room = EXCLUDED.room, stream = EXCLUDED.stream, updated_at = EXCLUDED.updated_at
        `.pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("SqlOutputRepository.saveSplitting")),
    });
  }),
);
