/**
 * Importe une traduction biblique au format USFM.
 *
 *   bun run bible:import -- <dossier-usfm> [--test]
 *
 * Par défaut : Louis Segond 1910 (eBible.org `fraLSG_usfm.zip`, domaine public).
 * `--test` cible TEST_DATABASE_URL au lieu de DATABASE_URL.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { PgClient } from "@effect/sql-pg";
import { runMigrations } from "@projection/platform";
import { Config, Effect, Layer } from "effect";

import { Translation } from "../src/domain/Scripture";
import { importTranslation } from "../src/infrastructure/ImportTranslation";
import { bibleMigrations } from "../src/migrations";

const directory = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const databaseVariable = process.argv.includes("--test") ? "TEST_DATABASE_URL" : "DATABASE_URL";

const lsg1910 = new Translation({
  id: "lsg1910",
  code: "LSG",
  name: "Louis Segond 1910",
  language: "fr",
  license: "Domaine public",
  organizationId: null,
});

const program = Effect.gen(function* () {
  if (directory === undefined) {
    return yield* Effect.fail(new Error("Usage : bun run bible:import -- <dossier-usfm> [--test]"));
  }

  const files = yield* Effect.promise(async () => {
    const names = (await readdir(directory)).filter((name) => name.endsWith(".usfm")).sort();
    return Promise.all(names.map((name) => readFile(join(directory, name), "utf8")));
  });

  yield* runMigrations([bibleMigrations]);
  const result = yield* importTranslation(lsg1910, files);
  yield* Effect.logInfo(
    `${lsg1910.name} : ${result.books} livres, ${result.verses} versets importés (${databaseVariable}).`,
  );
}).pipe(
  Effect.provide(
    PgClient.layerConfig({ url: Config.Redacted(databaseVariable) }).pipe(Layer.orDie),
  ),
);

Effect.runPromise(program).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
