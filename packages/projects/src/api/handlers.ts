import { Effect } from "effect";

import { Projects } from "../application/Projects";
import { ProjectsRpcs } from "./contract";

export const ProjectsHandlersLive = ProjectsRpcs.toLayer(
  Effect.gen(function* () {
    const projects = yield* Projects;

    return {
      ProjectsList: () => projects.list,
      ProjectsGet: ({ id }) => projects.get(id),
      ProjectsCreate: (input) => projects.create(input),
      ProjectsUpdate: ({ id, input }) => projects.update(id, input),
      ProjectsDelete: ({ id }) => projects.remove(id),
      ProjectsAddItem: ({ projectId, item, position }) =>
        projects.addItem(projectId, item, position),
      ProjectsRemoveItem: ({ projectId, itemId }) => projects.removeItem(projectId, itemId),
      ProjectsMoveItem: ({ projectId, itemId, toIndex }) =>
        projects.moveItem(projectId, itemId, toIndex),
    };
  }),
);
