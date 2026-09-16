import type { CurrentActor, ProjectId, SongId } from "@projection/shared-kernel";
import { Context, type Effect, type Option } from "effect";

import type { ImportedVideoPsalmSong } from "../domain/VideoPsalm";

/** Port : bibliothèque de chants (contexte songs), branché dans la composition root. */
export class SongLibrary extends Context.Service<
  SongLibrary,
  {
    findByExternalId(
      externalId: string,
    ): Effect.Effect<
      Option.Option<{ readonly id: SongId; readonly title: string }>,
      never,
      CurrentActor
    >;
    /** `null` si les paroles importées sont refusées par la bibliothèque. */
    create(
      song: ImportedVideoPsalmSong,
      externalId: string,
    ): Effect.Effect<SongId | null, never, CurrentActor>;
  }
>()("@projection/imports/SongLibrary") {}

/** Port : projets (contexte projects). */
export class ProjectLibrary extends Context.Service<
  ProjectLibrary,
  {
    create(name: string): Effect.Effect<ProjectId, never, CurrentActor>;
    addSong(projectId: ProjectId, songId: SongId): Effect.Effect<void, never, CurrentActor>;
  }
>()("@projection/imports/ProjectLibrary") {}
