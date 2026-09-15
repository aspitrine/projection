import { Layer } from "effect";

import { ProjectsHandlersLive } from "./api/handlers";
import { Projects } from "./application/Projects";
import { SqlProjectRepository } from "./infrastructure/SqlProjectRepository";

export { Projects } from "./application/Projects";

export { projectsMigrations } from "./migrations";

/** Cas d'usage du contexte, réutilisables par la composition root (ex. régie). */
export const ProjectsServiceLive = Projects.layer.pipe(Layer.provide(SqlProjectRepository));

/** Handlers RPC du contexte projects (requiert `PgClient` et `ActorMiddleware`). */
export const ProjectsLive = ProjectsHandlersLive.pipe(Layer.provide(ProjectsServiceLive));
