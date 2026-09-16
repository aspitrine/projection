import { describe, expect, it } from "@effect/vitest";
import { PgClient } from "@effect/sql-pg";
import { ActorMiddleware } from "@projection/identity/contract";
import { runMigrations } from "@projection/platform";
import { Actor, CurrentActor, OrganizationId, UserId } from "@projection/shared-kernel";
import { Config, Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";

import { BibleRpcs } from "../src/api/contract";
import { Translation } from "../src/domain/Scripture";
import { BibleLive, bibleMigrations, importTranslation } from "../src/server";
import { apocryphaUsfm, johnUsfm, psalmsUsfm } from "./fixtures";

/**
 * Tests fonctionnels : import USFM → SQL → cas d'usage → contrat RPC, sur Postgres.
 * Utilise une traduction dédiée pour ne pas toucher à un import réel.
 */
const testTranslation = new Translation({
  id: "test-lsg",
  code: "TST",
  name: "Traduction de test",
  language: "fr",
  license: "Domaine public",
  organizationId: null,
});

const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("TEST_DATABASE_URL") });

const Imported = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* runMigrations([bibleMigrations]);
    yield* importTranslation(testTranslation, [johnUsfm, psalmsUsfm, apocryphaUsfm]);
  }),
).pipe(Layer.provideMerge(DatabaseLive));

const FakeActorMiddleware = Layer.succeed(
  ActorMiddleware,
  ActorMiddleware.of((effect) =>
    Effect.provideService(
      effect,
      CurrentActor,
      new Actor({
        userId: UserId.make("user"),
        organizationId: OrganizationId.make("org"),
        // L'import et la traduction par défaut sont réservés aux administrateurs.
        role: "admin",
      }),
    ),
  ),
);

const ApiLive = Layer.mergeAll(BibleLive, FakeActorMiddleware).pipe(Layer.provideMerge(Imported));

describe.skipIf(!process.env.TEST_DATABASE_URL)("API bible (Postgres)", () => {
  it.effect("importe, liste les traductions et résout des passages", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(BibleRpcs);

      const translations = yield* client.BibleTranslations();
      expect(translations.map((translation) => translation.id)).toContain("lsg1910");
      expect(translations.map((translation) => translation.id)).toContain("test-lsg");

      const passage = yield* client.BibleLookup({
        translationId: "test-lsg",
        reference: "Jn 3.16-4.1",
      });
      expect(passage.label).toBe("Jean 3.16-4.1");
      expect(passage.verses.map((verse) => `${verse.chapter}.${verse.verse}`)).toEqual([
        "3.16",
        "3.17",
        "3.18",
        "4.1",
      ]);
      expect(passage.verses[0]?.text).toMatch(/^Car Dieu a tant aimé le monde/);

      const psalm = yield* client.BibleLookup({ translationId: "test-lsg", reference: "Ps 23" });
      expect(psalm.verses).toHaveLength(3);
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("ré-importer remplace les versets sans doublon", () =>
    Effect.gen(function* () {
      const first = yield* importTranslation(testTranslation, [
        johnUsfm,
        psalmsUsfm,
        apocryphaUsfm,
      ]);
      expect(first).toEqual({ books: 2, verses: 7 });
      const client = yield* RpcTest.makeClient(BibleRpcs);
      const chapter = yield* client.BibleLookup({ translationId: "test-lsg", reference: "Jean 3" });
      expect(chapter.verses).toHaveLength(3);
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("renvoie des erreurs typées", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(BibleRpcs);
      expect(
        yield* client
          .BibleLookup({ translationId: "test-lsg", reference: "Jean 21" })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "PassageNotFound" });
      expect(
        yield* client
          .BibleLookup({ translationId: "test-lsg", reference: "Jean" })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "InvalidReference", reason: "Malformed" });
      expect(
        yield* client
          .BibleLookup({ translationId: "absente", reference: "Jean 3" })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "UnknownTranslation" });
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("recherche par contenu : sans accents, ordre canonique, extrait surligné", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(BibleRpcs);

      // « aimé » cherché sans accent, et « eternelle » sans accent non plus.
      const found = yield* client.BibleSearch({ translationId: "test-lsg", query: "aime" });
      expect(found.map((match) => match.label)).toEqual(["Jean 3.16"]);
      expect(found[0]?.excerpt).toContain("«aimé»");

      const many = yield* client.BibleSearch({ translationId: "test-lsg", query: "monde" });
      // Ordre canonique : Jean 3.16 avant 3.17.
      expect(many.map((match) => match.label)).toEqual(["Jean 3.16", "Jean 3.17"]);

      expect(yield* client.BibleSearch({ translationId: "test-lsg", query: "zzz" })).toEqual([]);
      const unknown = yield* client
        .BibleSearch({ translationId: "inconnue", query: "monde" })
        .pipe(Effect.flip);
      expect(unknown._tag).toBe("UnknownTranslation");
    }).pipe(Effect.provide(ApiLive)),
  );

  it.effect("importe une traduction OSIS dans l'organisation et la choisit par défaut", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(BibleRpcs);
      const osis = `<osis><osisText>
        <div type="book" osisID="John">
          <verse osisID="John.3.16">Car Dieu a tant aim&#233; le monde</verse>
          <verse osisID="John.3.17">Dieu n'a pas envoy&#233; son Fils</verse>
        </div>
      </osisText></osis>`;

      const imported = yield* client.BibleImport({
        input: { code: "TSTX", name: "Traduction importée", language: "fr", license: "Test" },
        content: osis,
      });
      expect(imported).toMatchObject({ books: 1, verses: 2 });

      // Elle devient visible pour l'organisation, à côté des traductions livrées.
      const translations = yield* client.BibleTranslations();
      expect(translations.map((translation) => translation.id)).toContain(imported.translationId);

      const passage = yield* client.BibleLookup({
        translationId: imported.translationId,
        reference: "Jean 3.16",
      });
      expect(passage.verses[0]?.text).toBe("Car Dieu a tant aimé le monde");

      yield* client.BibleSetDefaultTranslation({ translationId: imported.translationId });
      expect(yield* client.BibleDefaultTranslation()).toBe(imported.translationId);

      // Un fichier illisible est refusé.
      const invalid = yield* client
        .BibleImport({
          input: { code: "BAD", name: "Mauvais", language: "fr", license: "Test" },
          content: "<html>pas une bible</html>",
        })
        .pipe(Effect.flip);
      expect(invalid).toMatchObject({ _tag: "InvalidTranslationFile", reason: "UnknownFormat" });
    }).pipe(Effect.provide(ApiLive)),
  );
});
