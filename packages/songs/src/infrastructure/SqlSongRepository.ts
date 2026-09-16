import { PgClient } from "@effect/sql-pg";
import { OrganizationId, SongId, excerptAround } from "@projection/shared-kernel";
import { Effect, Layer, Schema } from "effect";
import { SqlSchema } from "effect/unstable/sql";

import { SongRepository } from "../application/SongRepository";
import { Song, SongSummary } from "../domain/Song";
import { SongSection } from "../domain/SongSection";

const encodeSections = Schema.encodeSync(Schema.Array(SongSection));

const columns = (sql: PgClient.PgClient) => sql`
  id::text AS "id",
  organization_id AS "organizationId",
  title,
  authors,
  copyright,
  ccli,
  external_id AS "externalId",
  sections,
  arrangement,
  (extract(epoch FROM created_at) * 1000)::float8 AS "createdAt",
  (extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt"
`;

export const SqlSongRepository = Layer.effect(
  SongRepository,
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient;

    const list = SqlSchema.findAll({
      Request: Schema.Struct({
        organizationId: OrganizationId,
        search: Schema.NullOr(Schema.String),
      }),
      Result: SongSummary,
      // Recherche plein texte (français, sans accents) sur titre, auteurs et paroles ;
      // l'extrait montre le passage trouvé. Sans recherche, tri alphabétique.
      execute: ({ organizationId, search }) => sql`
        SELECT
          id::text AS "id",
          title,
          authors,
          ${search === null ? sql`NULL::text` : sql`search_source`} AS "excerpt",
          (extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt"
        FROM song
        WHERE organization_id = ${organizationId}
          ${
            search === null
              ? sql``
              : sql`AND (
                  search @@ websearch_to_tsquery('french', projection_unaccent(${search}))
                  OR projection_unaccent(title) ILIKE projection_unaccent(${`%${search}%`})
                )`
          }
        ORDER BY
          ${
            search === null
              ? sql``
              : sql`ts_rank(search, websearch_to_tsquery('french', projection_unaccent(${search}))) DESC,`
          }
          lower(title), id
      `,
    });

    const findById = SqlSchema.findOneOption({
      Request: Schema.Struct({ organizationId: OrganizationId, id: SongId }),
      Result: Song,
      execute: ({ organizationId, id }) => sql`
        SELECT ${columns(sql)} FROM song
        WHERE id = ${id}::uuid AND organization_id = ${organizationId}
      `,
    });

    const findByExternalId = SqlSchema.findOneOption({
      Request: Schema.Struct({ organizationId: OrganizationId, externalId: Schema.String }),
      Result: Song,
      execute: ({ organizationId, externalId }) => sql`
        SELECT ${columns(sql)} FROM song
        WHERE organization_id = ${organizationId} AND external_id = ${externalId}
      `,
    });

    /** Texte indexé : titre, auteurs et paroles à plat. */
    const searchSource = (song: Song) =>
      [song.title, song.authors ?? "", ...song.sections.flatMap((section) => section.lines)]
        .join(" ")
        .trim();

    const write = (song: Song) => ({
      title: song.title,
      authors: song.authors,
      copyright: song.copyright,
      ccli: song.ccli,
      sections: sql.json(encodeSections(song.sections)),
      searchSource: searchSource(song),
      arrangement: sql.json(song.arrangement),
      updatedAt: new Date(song.updatedAt),
    });

    return SongRepository.of({
      list: (organizationId, search) =>
        list({ organizationId, search }).pipe(
          // L'extrait est taillé côté application : le texte garde ses accents même
          // quand la recherche est écrite sans (Postgres, lui, compare sans accents).
          Effect.map((summaries) =>
            search === null
              ? summaries
              : summaries.map(
                  (summary) =>
                    new SongSummary({
                      ...summary,
                      excerpt: excerptAround(summary.excerpt ?? "", search),
                    }),
                ),
          ),
          Effect.orDie,
          Effect.withSpan("SqlSongRepository.list"),
        ),

      findByExternalId: (organizationId, externalId) =>
        findByExternalId({ organizationId, externalId }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlSongRepository.findByExternalId"),
        ),

      findById: (organizationId, id) =>
        findById({ organizationId, id }).pipe(
          Effect.orDie,
          Effect.withSpan("SqlSongRepository.findById"),
        ),

      insert: (song) => {
        const values = write(song);
        return sql`
          INSERT INTO song (id, organization_id, title, authors, copyright, ccli, external_id,
            sections, arrangement, search_source, created_at, updated_at)
          VALUES (${song.id}::uuid, ${song.organizationId}, ${values.title}, ${values.authors}, ${values.copyright},
                  ${values.ccli}, ${song.externalId}, ${values.sections}, ${values.arrangement},
                  ${values.searchSource}, ${new Date(song.createdAt)}, ${values.updatedAt})
        `.pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("SqlSongRepository.insert"));
      },

      update: (song) => {
        const values = write(song);
        return sql`
          UPDATE song SET
            title = ${values.title},
            authors = ${values.authors},
            copyright = ${values.copyright},
            ccli = ${values.ccli},
            sections = ${values.sections},
            arrangement = ${values.arrangement},
            search_source = ${values.searchSource},
            updated_at = ${values.updatedAt}
          WHERE id = ${song.id}::uuid AND organization_id = ${song.organizationId}
        `.pipe(Effect.asVoid, Effect.orDie, Effect.withSpan("SqlSongRepository.update"));
      },

      delete: (organizationId, id) =>
        sql<{ id: string }>`
          DELETE FROM song WHERE id = ${id}::uuid AND organization_id = ${organizationId}
          RETURNING id::text AS id
        `.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.orDie,
          Effect.withSpan("SqlSongRepository.delete"),
        ),
    });
  }),
);
