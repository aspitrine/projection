import { CurrentActor, ProjectId, ProjectItemId } from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Option } from "effect";

import { createItem, insertItem, moveItem, removeItem, setItemNotes } from "../domain/Items";
import {
  Project,
  type ProjectInput,
  type ProjectItemDraft,
  type ProjectItemNotFound,
  ProjectNotFound,
  type ProjectSummary,
} from "../domain/Project";
import { ProjectRepository } from "./ProjectRepository";

type Result<E = never> = Effect.Effect<Project, ProjectNotFound | E, CurrentActor>;

/** Cas d'usage des projets (cultes, événements), dans l'organisation de l'acteur courant. */
export class Projects extends Context.Service<
  Projects,
  {
    readonly list: Effect.Effect<ReadonlyArray<ProjectSummary>, never, CurrentActor>;
    get(id: ProjectId): Result;
    create(input: ProjectInput): Effect.Effect<Project, never, CurrentActor>;
    update(id: ProjectId, input: ProjectInput): Result;
    remove(id: ProjectId): Effect.Effect<void, ProjectNotFound, CurrentActor>;
    addItem(id: ProjectId, draft: ProjectItemDraft, position: number | null): Result;
    removeItem(id: ProjectId, itemId: ProjectItemId): Result<ProjectItemNotFound>;
    moveItem(id: ProjectId, itemId: ProjectItemId, toIndex: number): Result<ProjectItemNotFound>;
    /** Notes d'un élément, affichées sur le retour scène. */
    setItemNotes(
      id: ProjectId,
      itemId: ProjectItemId,
      notes: string | null,
    ): Result<ProjectItemNotFound>;
  }
>()("@projection/projects/Projects") {
  static readonly layer = Layer.effect(
    Projects,
    Effect.gen(function* () {
      const repository = yield* ProjectRepository;

      /** Applique une transformation atomique et met à jour `updatedAt`. */
      const modify = <E>(
        id: ProjectId,
        transform: (project: Project) => Effect.Effect<Project, E>,
      ) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const now = yield* Clock.currentTimeMillis;
          const result = yield* repository.modify(actor.organizationId, id, (project) =>
            transform(project).pipe(Effect.map((next) => new Project({ ...next, updatedAt: now }))),
          );
          return yield* Option.match(result, {
            onNone: () => Effect.fail(new ProjectNotFound({ id })),
            onSome: Effect.succeed,
          });
        });

      const withItems = (project: Project, items: Project["items"]): Project =>
        new Project({ ...project, items });

      return Projects.of({
        list: Effect.gen(function* () {
          const actor = yield* CurrentActor;
          return yield* repository.list(actor.organizationId);
        }).pipe(Effect.withSpan("Projects.list")),

        get: Effect.fn("Projects.get")(function* (id: ProjectId) {
          const actor = yield* CurrentActor;
          const project = yield* repository.findById(actor.organizationId, id);
          return yield* Option.match(project, {
            onNone: () => Effect.fail(new ProjectNotFound({ id })),
            onSome: Effect.succeed,
          });
        }),

        create: Effect.fn("Projects.create")(function* (input: ProjectInput) {
          const actor = yield* CurrentActor;
          const now = yield* Clock.currentTimeMillis;
          const project = new Project({
            id: ProjectId.make(crypto.randomUUID()),
            organizationId: actor.organizationId,
            name: input.name,
            date: input.date,
            items: [],
            createdAt: now,
            updatedAt: now,
          });
          yield* repository.insert(project);
          return project;
        }),

        update: (id, input) =>
          modify(id, (project) =>
            Effect.succeed(new Project({ ...project, name: input.name, date: input.date })),
          ).pipe(Effect.withSpan("Projects.update")),

        remove: Effect.fn("Projects.remove")(function* (id: ProjectId) {
          const actor = yield* CurrentActor;
          if (!(yield* repository.delete(actor.organizationId, id))) {
            return yield* new ProjectNotFound({ id });
          }
        }),

        addItem: (id, draft, position) =>
          modify(id, (project) =>
            Effect.sync(() =>
              withItems(
                project,
                insertItem(
                  project.items,
                  createItem(draft, ProjectItemId.make(crypto.randomUUID())),
                  position,
                ),
              ),
            ),
          ).pipe(Effect.withSpan("Projects.addItem")),

        removeItem: (id, itemId) =>
          modify(id, (project) =>
            removeItem(project.items, itemId).pipe(
              Effect.map((items) => withItems(project, items)),
            ),
          ).pipe(Effect.withSpan("Projects.removeItem")),

        setItemNotes: (id, itemId, notes) =>
          modify(id, (project) =>
            setItemNotes(project.items, itemId, notes).pipe(
              Effect.map((items) => withItems(project, items)),
            ),
          ).pipe(Effect.withSpan("Projects.setItemNotes")),

        moveItem: (id, itemId, toIndex) =>
          modify(id, (project) =>
            moveItem(project.items, itemId, toIndex).pipe(
              Effect.map((items) => withItems(project, items)),
            ),
          ).pipe(Effect.withSpan("Projects.moveItem")),
      });
    }),
  );
}
