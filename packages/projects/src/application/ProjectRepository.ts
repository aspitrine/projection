import type { OrganizationId, ProjectId } from "@projection/shared-kernel";
import { Context, Effect, Layer, Option, Ref } from "effect";

import { type Project, ProjectSummary } from "../domain/Project";

/** Port de persistance, limité à une organisation. */
export class ProjectRepository extends Context.Service<
  ProjectRepository,
  {
    list(organizationId: OrganizationId): Effect.Effect<ReadonlyArray<ProjectSummary>>;
    findById(organizationId: OrganizationId, id: ProjectId): Effect.Effect<Option.Option<Project>>;
    insert(project: Project): Effect.Effect<void>;
    /**
     * Lit, transforme et enregistre un projet de façon atomique (verrou de ligne en SQL) :
     * deux opérateurs qui modifient le même projet ne perdent pas leurs changements.
     */
    modify<E>(
      organizationId: OrganizationId,
      id: ProjectId,
      transform: (project: Project) => Effect.Effect<Project, E>,
    ): Effect.Effect<Option.Option<Project>, E>;
    delete(organizationId: OrganizationId, id: ProjectId): Effect.Effect<boolean>;
  }
>()("@projection/projects/ProjectRepository") {
  static readonly layerMemory = Layer.effect(
    ProjectRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<ProjectId, Project>());

      const find = (organizationId: OrganizationId, id: ProjectId) =>
        Ref.get(store).pipe(
          Effect.map((projects) =>
            Option.fromNullishOr(projects.get(id)).pipe(
              Option.filter((project) => project.organizationId === organizationId),
            ),
          ),
        );

      return ProjectRepository.of({
        list: (organizationId) =>
          Ref.get(store).pipe(
            Effect.map((projects) =>
              [...projects.values()]
                .filter((project) => project.organizationId === organizationId)
                .sort(
                  (a, b) =>
                    (b.date ?? "").localeCompare(a.date ?? "") || a.name.localeCompare(b.name),
                )
                .map(
                  (project) =>
                    new ProjectSummary({
                      id: project.id,
                      name: project.name,
                      date: project.date,
                      itemCount: project.items.length,
                      updatedAt: project.updatedAt,
                    }),
                ),
            ),
          ),
        findById: find,
        insert: (project) =>
          Ref.update(store, (projects) => new Map(projects).set(project.id, project)),
        modify: (organizationId, id, transform) =>
          Effect.gen(function* () {
            const current = yield* find(organizationId, id);
            if (Option.isNone(current)) return Option.none();
            const next = yield* transform(current.value);
            yield* Ref.update(store, (projects) => new Map(projects).set(id, next));
            return Option.some(next);
          }),
        delete: (organizationId, id) =>
          Ref.modify(store, (projects) => {
            const project = projects.get(id);
            if (project === undefined || project.organizationId !== organizationId) {
              return [false, projects] as const;
            }
            const next = new Map(projects);
            next.delete(id);
            return [true, next] as const;
          }),
      });
    }),
  );
}
