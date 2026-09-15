import { Layer } from "effect";

import { ProjectsHandlersLive } from "./api/handlers";
import { Projects } from "./application/Projects";
import { SqlProjectRepository } from "./infrastructure/SqlProjectRepository";

export { projectsMigrations } from "./migrations";

/** Handlers RPC du contexte projects (requiert `PgClient` et `ActorMiddleware`). */
export const ProjectsLive = ProjectsHandlersLive.pipe(
  Layer.provide(Projects.layer),
  Layer.provide(SqlProjectRepository),
);
