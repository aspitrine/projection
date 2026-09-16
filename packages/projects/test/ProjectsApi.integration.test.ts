import { describe, expect, it } from "@effect/vitest";
import { PgClient } from "@effect/sql-pg";
import { ActorMiddleware } from "@projection/identity/contract";
import { runMigrations } from "@projection/platform";
import {
  Actor,
  CurrentActor,
  OrganizationId,
  SongId,
  TextSlideId,
  UserId,
} from "@projection/shared-kernel";
import { Config, Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";

import { ProjectsRpcs } from "../src/api/contract";
import { ProjectsLive, projectsMigrations } from "../src/server";

/** Tests fonctionnels de l'API projects sur Postgres (TEST_DATABASE_URL). */
const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("TEST_DATABASE_URL") });

const MigratedDatabase = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* runMigrations([projectsMigrations]);
    const sql = yield* PgClient.PgClient;
    yield* sql`TRUNCATE project`;
  }),
).pipe(Layer.provideMerge(DatabaseLive));

const FakeActorMiddleware = Layer.succeed(
  ActorMiddleware,
  ActorMiddleware.of((effect, { headers }) =>
    Effect.provideService(
      effect,
      CurrentActor,
      new Actor({
        userId: UserId.make("user"),
        organizationId: OrganizationId.make(headers["x-test-organization"] ?? "org-a"),
        role: "operator",
      }),
    ),
  ),
);

const ApiLive = Layer.mergeAll(ProjectsLive, FakeActorMiddleware).pipe(
  Layer.provideMerge(MigratedDatabase),
);

const songId = SongId.make("11111111-1111-4111-8111-111111111111");
const textSlideId = TextSlideId.make("22222222-2222-4222-8222-222222222222");

describe.skipIf(!process.env.TEST_DATABASE_URL)("API projects (Postgres)", () => {
  it.effect("crée un projet, compose et réordonne ses éléments", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(ProjectsRpcs);
      const project = yield* client.ProjectsCreate({
        name: "Culte du dimanche",
        date: "2026-09-21",
      });

      yield* client.ProjectsAddItem({
        projectId: project.id,
        item: { _tag: "Song", songId },
        position: null,
      });
      yield* client.ProjectsAddItem({
        projectId: project.id,
        item: { _tag: "Scripture", translationId: "lsg1910", reference: "Jean 3.16-18" },
        position: null,
      });
      const full = yield* client.ProjectsAddItem({
        projectId: project.id,
        item: { _tag: "TextSlide", textSlideId },
        position: 1,
      });
      expect(full.items.map((item) => item._tag)).toEqual(["Song", "TextSlide", "Scripture"]);

      const last = full.items[2];
      if (last === undefined) throw new Error("élément manquant");
      const moved = yield* client.ProjectsMoveItem({
        projectId: project.id,
        itemId: last.id,
        toIndex: 0,
      });
      expect(moved.items.map((item) => item._tag)).toEqual(["Scripture", "Song", "TextSlide"]);

      const fetched = yield* client.ProjectsGet({ id: project.id });
      expect(fetched).toEqual(moved);
      expect(fetched.date).toBe("2026-09-21");

      const [summary] = yield* client.ProjectsList();
      expect(summary).toMatchObject({ name: "Culte du dimanche", itemCount: 3 });

      const unknownItem = yield* client
        .ProjectsRemoveItem({ projectId: project.id, itemId: textSlideId as never })
        .pipe(Effect.flip);
      expect(unknownItem._tag).toBe("ProjectItemNotFound");

      const updated = yield* client.ProjectsUpdate({
        id: project.id,
        input: { name: "Culte", date: null },
      });
      expect(updated).toMatchObject({ name: "Culte", date: null });
      expect(updated.items).toHaveLength(3);

      yield* client.ProjectsDelete({ id: project.id });
      expect((yield* client.ProjectsGet({ id: project.id }).pipe(Effect.flip))._tag).toBe(
        "ProjectNotFound",
      );
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("des ajouts simultanés ne se perdent pas (verrou de ligne)", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(ProjectsRpcs);
      const project = yield* client.ProjectsCreate({ name: "Concurrence", date: null });

      yield* Effect.all(
        Array.from({ length: 10 }, () =>
          client.ProjectsAddItem({
            projectId: project.id,
            item: { _tag: "Blank" },
            position: null,
          }),
        ),
        { concurrency: "unbounded" },
      );

      expect((yield* client.ProjectsGet({ id: project.id })).items).toHaveLength(10);
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("isole les organisations", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(ProjectsRpcs);
      const project = yield* client.ProjectsCreate({ name: "Privé", date: null });
      const otherOrganization = { headers: { "x-test-organization": "org-b" } };

      expect(yield* client.ProjectsList(undefined, otherOrganization)).toEqual([]);
      const error = yield* client
        .ProjectsAddItem(
          { projectId: project.id, item: { _tag: "Blank" }, position: null },
          otherOrganization,
        )
        .pipe(Effect.flip);
      expect(error._tag).toBe("ProjectNotFound");
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("enregistre les notes d'un élément et les relit", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(ProjectsRpcs);
      const created = yield* client.ProjectsCreate({ name: "Notes", date: null });
      const withItem = yield* client.ProjectsAddItem({
        projectId: created.id,
        item: { _tag: "Song", songId },
        position: null,
      });
      const itemId = withItem.items[0]!.id;

      const noted = yield* client.ProjectsSetItemNotes({
        projectId: created.id,
        itemId,
        notes: "Tonalité : Sol",
      });
      expect(noted.items[0]).toMatchObject({ notes: "Tonalité : Sol" });
      const reloaded = yield* client.ProjectsGet({ id: created.id });
      expect(reloaded.items[0]).toMatchObject({ notes: "Tonalité : Sol" });

      const cleared = yield* client.ProjectsSetItemNotes({
        projectId: created.id,
        itemId,
        notes: null,
      });
      expect(cleared.items[0]?.notes).toBeUndefined();
    }).pipe(Effect.provide(ApiLive)),
  );
});
