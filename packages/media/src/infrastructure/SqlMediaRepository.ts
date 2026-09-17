import { MediaId, OrganizationId } from "@projection/shared-kernel";
import { Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

import { MediaRepository } from "../application/ports";
import { MediaAsset } from "../domain/Media";

export const SqlMediaRepository = Layer.effect(
  MediaRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const columns = sql`
      id::text AS "id", organization_id AS "organizationId", kind, name,
      content_type AS "contentType", size_bytes::int AS "sizeBytes",
      storage_key AS "storageKey", ready,
      (extract(epoch FROM created_at) * 1000)::float8 AS "createdAt"
    `;
    const request = Schema.Struct({ organizationId: OrganizationId, id: MediaId });

    const list = SqlSchema.findAll({
      Request: OrganizationId,
      Result: MediaAsset,
      execute: (organizationId) =>
        sql`SELECT ${columns} FROM media_asset WHERE organization_id = ${organizationId} ORDER BY created_at DESC, id`,
    });

    const findById = SqlSchema.findOneOption({
      Request: request,
      Result: MediaAsset,
      execute: ({ organizationId, id }) =>
        sql`SELECT ${columns} FROM media_asset WHERE id = ${id}::uuid AND organization_id = ${organizationId}`,
    });

    const markReady = SqlSchema.findOneOption({
      Request: request,
      Result: MediaAsset,
      execute: ({ organizationId, id }) => sql`
        UPDATE media_asset SET ready = true
        WHERE id = ${id}::uuid AND organization_id = ${organizationId}
        RETURNING ${columns}
      `,
    });

    const rename = SqlSchema.findOneOption({
      Request: Schema.Struct({ organizationId: OrganizationId, id: MediaId, name: Schema.String }),
      Result: MediaAsset,
      execute: ({ organizationId, id, name }) => sql`
        UPDATE media_asset SET name = ${name}
        WHERE id = ${id}::uuid AND organization_id = ${organizationId}
        RETURNING ${columns}
      `,
    });

    const remove = SqlSchema.findOneOption({
      Request: request,
      Result: MediaAsset,
      execute: ({ organizationId, id }) => sql`
        DELETE FROM media_asset
        WHERE id = ${id}::uuid AND organization_id = ${organizationId}
        RETURNING ${columns}
      `,
    });

    return MediaRepository.of({
      list: (organizationId) =>
        list(organizationId).pipe(Effect.orDie, Effect.withSpan("SqlMediaRepository.list")),
      findById: (organizationId, id) =>
        findById({ organizationId, id }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlMediaRepository.findById"),
        ),
      insert: (asset) =>
        sql`
          INSERT INTO media_asset (id, organization_id, kind, name, content_type, size_bytes,
            storage_key, ready, created_at)
          VALUES (${asset.id}::uuid, ${asset.organizationId}, ${asset.kind}, ${asset.name},
                  ${asset.contentType}, ${asset.sizeBytes}, ${asset.storageKey}, ${asset.ready},
                  ${new Date(asset.createdAt)})
        `.pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("SqlMediaRepository.insert")),
      markReady: (organizationId, id) =>
        markReady({ organizationId, id }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlMediaRepository.markReady"),
        ),
      rename: (organizationId, id, name) =>
        rename({ organizationId, id, name }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlMediaRepository.rename"),
        ),
      delete: (organizationId, id) =>
        remove({ organizationId, id }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlMediaRepository.delete"),
        ),
    });
  }),
);
