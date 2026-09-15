import { PgClient } from "@effect/sql-pg";
import { OrganizationId, ProjectId } from "@projection/shared-kernel";
import { Effect, Layer, Option, Schema } from "effect";
import { SqlSchema } from "effect/unstable/sql";

import { ProjectRepository } from "../application/ProjectRepository";
import { Project, ProjectItem, ProjectSummary } from "../domain/Project";

const encodeItems = Schema.encodeSync(Schema.Array(ProjectItem));

export const SqlProjectRepository = Layer.effect(
  ProjectRepository,
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient;

    const columns = sql`
      id::text AS "id", organization_id AS "organizationId", name,
      to_char(date, 'YYYY-MM-DD') AS "date", items,
      (extract(epoch FROM created_at) * 1000)::float8 AS "createdAt",
      (extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt"
    `;

    const list = SqlSchema.findAll({
      Request: OrganizationId,
      Result: ProjectSummary,
      execute: (organizationId) => sql`
        SELECT id::text AS "id", name, to_char(date, 'YYYY-MM-DD') AS "date",
          jsonb_array_length(items) AS "itemCount",
          (extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt"
        FROM project
        WHERE organization_id = ${organizationId}
        ORDER BY date DESC NULLS LAST, lower(name), id
      `,
    });

    const request = Schema.Struct({ organizationId: OrganizationId, id: ProjectId });

    const findById = SqlSchema.findOneOption({
      Request: request,
      Result: Project,
      execute: ({ organizationId, id }) =>
        sql`SELECT ${columns} FROM project WHERE id = ${id}::uuid AND organization_id = ${organizationId}`,
    });

    const findForUpdate = SqlSchema.findOneOption({
      Request: request,
      Result: Project,
      execute: ({ organizationId, id }) => sql`
        SELECT ${columns} FROM project
        WHERE id = ${id}::uuid AND organization_id = ${organizationId}
        FOR UPDATE
      `,
    });

    return ProjectRepository.of({
      list: (organizationId) =>
        list(organizationId).pipe(Effect.orDie, Effect.withSpan("SqlProjectRepository.list")),

      findById: (organizationId, id) =>
        findById({ organizationId, id }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlProjectRepository.findById"),
        ),

      insert: (project) =>
        sql`
          INSERT INTO project (id, organization_id, name, date, items, created_at, updated_at)
          VALUES (${project.id}::uuid, ${project.organizationId}, ${project.name}, ${project.date}::date,
                  ${sql.json(encodeItems(project.items))}, ${new Date(project.createdAt)}, ${new Date(project.updatedAt)})
        `.pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("SqlProjectRepository.insert")),

      modify: (organizationId, id, transform) =>
        Effect.gen(function* () {
          const current = yield* findForUpdate({ organizationId, id }).pipe(Effect.orDie);
          if (Option.isNone(current)) return Option.none();
          const next = yield* transform(current.value);
          yield* sql`
            UPDATE project SET
              name = ${next.name},
              date = ${next.date}::date,
              items = ${sql.json(encodeItems(next.items))},
              updated_at = ${new Date(next.updatedAt)}
            WHERE id = ${id}::uuid AND organization_id = ${organizationId}
          `.pipe(Effect.orDie);
          return Option.some(next);
        }).pipe(
          sql.withTransaction,
          Effect.catchTag("SqlError", (error) => Effect.die(error)),
          Effect.withSpan("SqlProjectRepository.modify"),
        ),

      delete: (organizationId, id) =>
        sql<{ id: string }>`
          DELETE FROM project WHERE id = ${id}::uuid AND organization_id = ${organizationId}
          RETURNING id::text AS id
        `.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.orDie,
          Effect.withSpan("SqlProjectRepository.delete"),
        ),
    });
  }),
);
