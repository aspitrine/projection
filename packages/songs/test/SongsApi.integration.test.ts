import { describe, expect, it } from "@effect/vitest";
import { PgClient } from "@effect/sql-pg";
import { ActorMiddleware } from "@projection/identity/contract";
import { runMigrations } from "@projection/platform";
import { Actor, CurrentActor, OrganizationId, UserId } from "@projection/shared-kernel";
import { Config, Effect, Exit, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";

import { SongsRpcs } from "../src/api/contract";
import { songsMigrations, SongsLive } from "../src/server";

/**
 * Tests fonctionnels de l'API songs : contrat RPC → cas d'usage → SQL, sur un
 * vrai Postgres. Nécessite TEST_DATABASE_URL (`bun run test:integration`).
 */
const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("TEST_DATABASE_URL") });

const MigratedDatabase = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* runMigrations([songsMigrations]);
    const sql = yield* SqlClient.SqlClient;
    yield* sql`TRUNCATE song`;
  }),
).pipe(Layer.provideMerge(DatabaseLive));

/** Simule l'ActorMiddleware : l'organisation est lue dans l'en-tête `x-test-organization`. */
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

const ApiLive = Layer.mergeAll(SongsLive, FakeActorMiddleware).pipe(
  Layer.provideMerge(MigratedDatabase),
);

const lyrics =
  "[Couplet 1]\nIl est bon de louer le Seigneur\n[Refrain]\nAlléluia\n[Couplet 2]\nTes bienfaits\n[Refrain]";

describe.skipIf(!process.env.TEST_DATABASE_URL)("API songs (Postgres)", () => {
  it.effect("parcours complet : création, lecture, recherche, mise à jour, suppression", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(SongsRpcs);

      const created = yield* client.SongsCreate({
        title: "Il est bon",
        authors: "Paul Wilbur",
        copyright: null,
        ccli: "669",
        lyrics,
      });
      expect(created.arrangement).toEqual(["verse-1", "chorus", "verse-2", "chorus"]);

      const fetched = yield* client.SongsGet({ id: created.id });
      expect(fetched).toEqual(created);

      yield* client.SongsCreate({
        title: "Gloire à son nom",
        authors: null,
        copyright: null,
        ccli: null,
        lyrics: "Gloire",
      });
      const all = yield* client.SongsList({ search: null });
      expect(all.map((song) => song.title)).toEqual(["Gloire à son nom", "Il est bon"]);
      const searched = yield* client.SongsList({ search: "BON" });
      expect(searched.map((song) => song.id)).toEqual([created.id]);

      const updated = yield* client.SongsUpdate({
        id: created.id,
        input: {
          title: "Il est bon de louer",
          authors: null,
          copyright: null,
          ccli: null,
          lyrics: "[Refrain]\nGloire",
        },
      });
      expect(updated.title).toBe("Il est bon de louer");
      expect(updated.authors).toBeNull();
      expect(updated.createdAt).toBe(created.createdAt);
      expect(yield* client.SongsGet({ id: created.id })).toEqual(updated);

      yield* client.SongsDelete({ id: created.id });
      const error = yield* client.SongsGet({ id: created.id }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "SongNotFound", id: created.id });
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("renvoie des erreurs typées au client", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(SongsRpcs);
      const invalid = yield* client
        .SongsCreate({
          title: "Vide",
          authors: null,
          copyright: null,
          ccli: null,
          lyrics: "[Refrain]",
        })
        .pipe(Effect.flip);
      expect(invalid).toMatchObject({ _tag: "InvalidLyrics", reason: "UndefinedRepeat" });

      const created = yield* client.SongsCreate({
        title: "A",
        authors: null,
        copyright: null,
        ccli: null,
        lyrics: "A",
      });
      const duplicate = yield* client
        .SongsUpdate({
          id: created.id,
          input: {
            title: "A",
            authors: null,
            copyright: null,
            ccli: null,
            lyrics: "[Refrain]\nA\n[Refrain]\nB",
          },
        })
        .pipe(Effect.flip);
      expect(duplicate).toMatchObject({ _tag: "InvalidLyrics", reason: "DuplicateSection" });
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("isole les organisations au niveau SQL", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(SongsRpcs);
      const created = yield* client.SongsCreate({
        title: "Privé",
        authors: null,
        copyright: null,
        ccli: null,
        lyrics: "A",
      });

      const otherOrganization = { headers: { "x-test-organization": "org-b" } };
      expect(yield* client.SongsList({ search: null }, otherOrganization)).toEqual([]);
      const notFound = yield* client
        .SongsGet({ id: created.id }, otherOrganization)
        .pipe(Effect.flip);
      expect(notFound._tag).toBe("SongNotFound");
      const notDeleted = yield* client
        .SongsDelete({ id: created.id }, otherOrganization)
        .pipe(Effect.flip);
      expect(notDeleted._tag).toBe("SongNotFound");

      expect((yield* client.SongsGet({ id: created.id })).title).toBe("Privé");
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("importe des fichiers ChordPro et refuse un lot trop gros", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(SongsRpcs);
      const organization = { headers: { "x-test-organization": "org-import" } };

      const report = yield* client.SongsImport(
        {
          format: "chordpro",
          files: [
            { fileName: "a.cho", content: "{title: Chant importé}\n{sov}\n[D]Ligne un\n{eov}" },
            { fileName: "b.cho", content: "{title: Chant importé}\nCopie" },
          ],
        },
        organization,
      );
      expect(report.imported.map((entry) => entry.title)).toEqual(["Chant importé"]);
      expect(report.duplicates).toHaveLength(1);

      const found = yield* client.SongsList({ search: "importé" }, organization);
      expect(found.map((song) => song.title)).toEqual(["Chant importé"]);

      const tooMany = yield* client
        .SongsImport(
          {
            format: "chordpro",
            files: Array.from({ length: 51 }, (_, index) => ({
              fileName: `${index}.cho`,
              content: "x",
            })),
          },
          organization,
        )
        .pipe(Effect.exit);
      expect(Exit.isFailure(tooMany)).toBe(true);
    }).pipe(Effect.provide(ApiLive)),
  );
});
