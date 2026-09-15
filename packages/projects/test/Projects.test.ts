import { describe, expect, it } from "@effect/vitest";
import { Actor, CurrentActor, OrganizationId, SongId, UserId } from "@projection/shared-kernel";
import { Effect, Layer } from "effect";

import { ProjectRepository } from "../src/application/ProjectRepository";
import { Projects } from "../src/application/Projects";
import { ProjectInput } from "../src/domain/Project";

const TestLayer = Projects.layer.pipe(Layer.provideMerge(ProjectRepository.layerMemory));

const inOrganization = (organizationId: string) =>
  Effect.provideService(
    CurrentActor,
    new Actor({
      userId: UserId.make("user"),
      organizationId: OrganizationId.make(organizationId),
      role: "operator",
    }),
  );

const songId = SongId.make("11111111-1111-4111-8111-111111111111");

describe("Projects", () => {
  it.effect("compose l'ordre de passage d'un culte", () =>
    Effect.gen(function* () {
      const projects = yield* Projects;
      const project = yield* projects
        .create(new ProjectInput({ name: "Culte du 21 septembre", date: "2026-09-21" }))
        .pipe(inOrganization("org-a"));

      yield* projects
        .addItem(project.id, { _tag: "Song", songId }, null)
        .pipe(inOrganization("org-a"));
      yield* projects
        .addItem(
          project.id,
          { _tag: "Scripture", translationId: "lsg1910", reference: "Jean 3.16" },
          null,
        )
        .pipe(inOrganization("org-a"));
      const withBlank = yield* projects
        .addItem(project.id, { _tag: "Blank" }, 0)
        .pipe(inOrganization("org-a"));
      expect(withBlank.items.map((item) => item._tag)).toEqual(["Blank", "Song", "Scripture"]);

      const scripture = withBlank.items[2];
      if (scripture === undefined) throw new Error("élément manquant");
      const moved = yield* projects
        .moveItem(project.id, scripture.id, 0)
        .pipe(inOrganization("org-a"));
      expect(moved.items.map((item) => item._tag)).toEqual(["Scripture", "Blank", "Song"]);

      const removed = yield* projects
        .removeItem(project.id, scripture.id)
        .pipe(inOrganization("org-a"));
      expect(removed.items.map((item) => item._tag)).toEqual(["Blank", "Song"]);
      expect(yield* projects.get(project.id).pipe(inOrganization("org-a"))).toEqual(removed);

      const [summary] = yield* projects.list.pipe(inOrganization("org-a"));
      expect(summary).toMatchObject({ name: "Culte du 21 septembre", itemCount: 2 });
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("renomme, supprime et isole les organisations", () =>
    Effect.gen(function* () {
      const projects = yield* Projects;
      const project = yield* projects
        .create(new ProjectInput({ name: "Veillée", date: null }))
        .pipe(inOrganization("org-a"));

      const renamed = yield* projects
        .update(project.id, new ProjectInput({ name: "Veillée de prière", date: "2026-10-01" }))
        .pipe(inOrganization("org-a"));
      expect(renamed).toMatchObject({ name: "Veillée de prière", date: "2026-10-01" });

      expect(yield* projects.list.pipe(inOrganization("org-b"))).toEqual([]);
      const foreign = yield* projects
        .addItem(project.id, { _tag: "Blank" }, null)
        .pipe(inOrganization("org-b"), Effect.flip);
      expect(foreign._tag).toBe("ProjectNotFound");

      yield* projects.remove(project.id).pipe(inOrganization("org-a"));
      expect(
        (yield* projects.get(project.id).pipe(inOrganization("org-a"), Effect.flip))._tag,
      ).toBe("ProjectNotFound");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("trie les projets par date décroissante, sans date à la fin", () =>
    Effect.gen(function* () {
      const projects = yield* Projects;
      for (const [name, date] of [
        ["B", "2026-01-01"],
        ["Sans date", null],
        ["A", "2026-06-01"],
      ] as const) {
        yield* projects.create(new ProjectInput({ name, date })).pipe(inOrganization("org-a"));
      }
      expect(
        (yield* projects.list.pipe(inOrganization("org-a"))).map((project) => project.name),
      ).toEqual(["A", "B", "Sans date"]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
