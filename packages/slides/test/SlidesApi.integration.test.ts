import { describe, expect, it } from "@effect/vitest";
import { PgClient } from "@effect/sql-pg";
import { ActorMiddleware } from "@projection/identity/contract";
import { runMigrations } from "@projection/platform";
import { Actor, CurrentActor, OrganizationId, UserId } from "@projection/shared-kernel";
import { Config, Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";

import { SlidesRpcs } from "../src/api/contract";
import { SlidesLive, slidesMigrations } from "../src/server";

/** Tests fonctionnels de l'API slides sur Postgres (TEST_DATABASE_URL). */
const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("TEST_DATABASE_URL") });

const MigratedDatabase = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* runMigrations([slidesMigrations]);
    const sql = yield* SqlClient.SqlClient;
    yield* sql`TRUNCATE text_slide`;
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

const ApiLive = Layer.mergeAll(SlidesLive, FakeActorMiddleware).pipe(
  Layer.provideMerge(MigratedDatabase),
);

describe.skipIf(!process.env.TEST_DATABASE_URL)("API slides (Postgres)", () => {
  it.effect("CRUD complet, recherche et erreurs typées", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(SlidesRpcs);

      const created = yield* client.SlidesCreate({
        title: "Annonces",
        source: "# Annonces\n- Repas *12 h*",
      });
      expect(yield* client.SlidesGet({ id: created.id })).toEqual(created);

      yield* client.SlidesCreate({ title: "Bienvenue", source: "Bienvenue à tous" });
      expect((yield* client.SlidesList({ search: null })).map((slide) => slide.title)).toEqual([
        "Annonces",
        "Bienvenue",
      ]);
      expect((yield* client.SlidesList({ search: "annon" })).map((slide) => slide.id)).toEqual([
        created.id,
      ]);

      const updated = yield* client.SlidesUpdate({
        id: created.id,
        input: { title: "Annonces du dimanche", source: "Culte à **10 h**" },
      });
      expect(updated.createdAt).toBe(created.createdAt);
      expect(yield* client.SlidesGet({ id: created.id })).toEqual(updated);

      const empty = yield* client
        .SlidesUpdate({ id: created.id, input: { title: "Vide", source: "  " } })
        .pipe(Effect.flip);
      expect(empty._tag).toBe("EmptyTextSlide");

      const otherOrganization = { headers: { "x-test-organization": "org-b" } };
      expect(yield* client.SlidesList({ search: null }, otherOrganization)).toEqual([]);
      expect(
        (yield* client.SlidesDelete({ id: created.id }, otherOrganization).pipe(Effect.flip))._tag,
      ).toBe("TextSlideNotFound");

      yield* client.SlidesDelete({ id: created.id });
      expect((yield* client.SlidesGet({ id: created.id }).pipe(Effect.flip))._tag).toBe(
        "TextSlideNotFound",
      );
    }).pipe(Effect.provide(ApiLive)),
  );
});
