import { describe, expect, it } from "@effect/vitest";
import {
  Actor,
  CurrentActor,
  OrganizationId,
  ProjectId,
  SongId,
  UserId,
} from "@projection/shared-kernel";
import { Effect, Layer, Option, Ref } from "effect";
import { readFileSync } from "node:fs";

import { Imports, projectNameFrom } from "../src/application/Imports";
import { ProjectLibrary, SongLibrary } from "../src/application/ports";

const fixture = readFileSync(
  new URL("../../songs/test/fixtures/videopsalm/culte-synthetique.vpagd", import.meta.url),
);

const asActor = Effect.provideService(
  CurrentActor,
  new Actor({
    userId: UserId.make("user"),
    organizationId: OrganizationId.make("org-a"),
    role: "operator",
  }),
);

const projectId = ProjectId.make("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const songId = (index: number) =>
  SongId.make(`00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`);

/** Bibliothèque et projets en mémoire : on observe ce que l'import y écrit. */
const makeLibraries = (options: { readonly refuse?: ReadonlyArray<string> } = {}) =>
  Effect.gen(function* () {
    const created = yield* Ref.make<ReadonlyArray<{ externalId: string; title: string }>>([]);
    const known = yield* Ref.make(new Map<string, { id: SongId; title: string }>());
    const items = yield* Ref.make<ReadonlyArray<SongId>>([]);
    const projects = yield* Ref.make<ReadonlyArray<string>>([]);

    const layer = Layer.mergeAll(
      Layer.succeed(
        SongLibrary,
        SongLibrary.of({
          findByExternalId: (externalId) =>
            Ref.get(known).pipe(Effect.map((map) => Option.fromNullishOr(map.get(externalId)))),
          create: (song, externalId) =>
            Effect.gen(function* () {
              if (options.refuse?.includes(song.title) === true) return null;
              const list = yield* Ref.get(created);
              const id = songId(list.length + 1);
              yield* Ref.update(created, (current) => [
                ...current,
                { externalId, title: song.title },
              ]);
              yield* Ref.update(known, (map) =>
                new Map(map).set(externalId, { id, title: song.title }),
              );
              return id;
            }),
        }),
      ),
      Layer.succeed(
        ProjectLibrary,
        ProjectLibrary.of({
          create: (name) =>
            Ref.update(projects, (current) => [...current, name]).pipe(Effect.as(projectId)),
          addSong: (_projectId, id) => Ref.update(items, (current) => [...current, id]),
        }),
      ),
    );

    return { layer, created, items, projects };
  });

describe("projectNameFrom", () => {
  it("prend le nom du fichier sans extension", () => {
    expect(projectNameFrom("Culte-du-21-septembre.vpagd")).toBe("Culte du 21 septembre");
    expect(projectNameFrom(".vpagd")).toBe("Agenda importé");
  });
});

describe("Imports.importVideoPsalm", () => {
  it.effect("crée les chants absents puis le projet dans l'ordre de l'agenda", () =>
    Effect.gen(function* () {
      const libraries = yield* makeLibraries();

      yield* Effect.gen(function* () {
        const imports = yield* Imports;
        const report = yield* imports
          .importVideoPsalm("Culte synthetique.vpagd", fixture)
          .pipe(asActor);

        expect(report.projectName).toBe("Culte synthetique");
        expect(report.imported.map((song) => song.title)).toEqual([
          "Lumière du matin",
          "Petit chant",
        ]);
        expect(report.reused).toEqual([]);
        expect(yield* Ref.get(libraries.items)).toHaveLength(2);
        expect((yield* Ref.get(libraries.created)).map((song) => song.externalId)).toEqual([
          "videopsalm:0000000000000000000001",
          "videopsalm:0000000000000000000002",
        ]);

        // Deuxième import du même agenda : aucun doublon, un nouveau projet.
        const again = yield* imports.importVideoPsalm("Culte.vpagd", fixture).pipe(asActor);
        expect(again.imported).toEqual([]);
        expect(again.reused.map((song) => song.title)).toEqual(["Lumière du matin", "Petit chant"]);
        expect(yield* Ref.get(libraries.projects)).toEqual(["Culte synthetique", "Culte"]);
        expect(yield* Ref.get(libraries.items)).toHaveLength(4);
      }).pipe(Effect.provide(Imports.layer.pipe(Layer.provideMerge(libraries.layer))));
    }),
  );

  it.effect("signale les chants refusés et rejette un fichier illisible", () =>
    Effect.gen(function* () {
      const libraries = yield* makeLibraries({ refuse: ["Petit chant"] });

      yield* Effect.gen(function* () {
        const imports = yield* Imports;
        const report = yield* imports.importVideoPsalm("Culte.vpagd", fixture).pipe(asActor);
        expect(report.imported.map((song) => song.title)).toEqual(["Lumière du matin"]);
        expect(report.errors).toEqual([{ title: "Petit chant" }]);
        expect(yield* Ref.get(libraries.items)).toHaveLength(1);

        const invalid = yield* imports
          .importVideoPsalm("x.vpagd", new TextEncoder().encode("pas une archive"))
          .pipe(asActor, Effect.flip);
        expect(invalid.reason).toBe("NotAnArchive");
      }).pipe(Effect.provide(Imports.layer.pipe(Layer.provideMerge(libraries.layer))));
    }),
  );
});
