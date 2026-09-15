import { OrganizationId, TextSlideId } from "@projection/shared-kernel";
import { Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";

import { TextSlideRepository } from "../application/TextSlideRepository";
import { TextSlide, TextSlideSummary } from "../domain/TextSlide";

const epochMs = (column: string) => `(extract(epoch FROM ${column}) * 1000)::float8`;

export const SqlTextSlideRepository = Layer.effect(
  TextSlideRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const list = SqlSchema.findAll({
      Request: Schema.Struct({
        organizationId: OrganizationId,
        search: Schema.NullOr(Schema.String),
      }),
      Result: TextSlideSummary,
      execute: ({ organizationId, search }) => sql`
        SELECT id::text AS "id", title, ${sql.literal(epochMs("updated_at"))} AS "updatedAt"
        FROM text_slide
        WHERE organization_id = ${organizationId}
          ${search === null ? sql`` : sql`AND title ILIKE ${`%${search}%`}`}
        ORDER BY lower(title), id
      `,
    });

    const findById = SqlSchema.findOneOption({
      Request: Schema.Struct({ organizationId: OrganizationId, id: TextSlideId }),
      Result: TextSlide,
      execute: ({ organizationId, id }) => sql`
        SELECT id::text AS "id", organization_id AS "organizationId", title, source,
          ${sql.literal(epochMs("created_at"))} AS "createdAt",
          ${sql.literal(epochMs("updated_at"))} AS "updatedAt"
        FROM text_slide
        WHERE id = ${id}::uuid AND organization_id = ${organizationId}
      `,
    });

    return TextSlideRepository.of({
      list: (organizationId, search) =>
        list({ organizationId, search }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlTextSlideRepository.list"),
        ),
      findById: (organizationId, id) =>
        findById({ organizationId, id }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlTextSlideRepository.findById"),
        ),
      save: (slide) =>
        sql`
          INSERT INTO text_slide (id, organization_id, title, source, created_at, updated_at)
          VALUES (${slide.id}::uuid, ${slide.organizationId}, ${slide.title}, ${slide.source},
                  ${new Date(slide.createdAt)}, ${new Date(slide.updatedAt)})
          ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, source = EXCLUDED.source,
            updated_at = EXCLUDED.updated_at
          WHERE text_slide.organization_id = EXCLUDED.organization_id
        `.pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("SqlTextSlideRepository.save")),
      delete: (organizationId, id) =>
        sql<{ id: string }>`
          DELETE FROM text_slide WHERE id = ${id}::uuid AND organization_id = ${organizationId}
          RETURNING id::text AS id
        `.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.orDie,
          Effect.withSpan("SqlTextSlideRepository.delete"),
        ),
    });
  }),
);
