import { ProjectLibrary, SongLibrary } from "@projection/imports/server";
import { ProjectInput } from "@projection/projects/domain";
import { Projects } from "@projection/projects/server";
import { SongInput } from "@projection/songs/domain";
import { Songs } from "@projection/songs/server";
import { Effect, Layer, Option } from "effect";

/** L'import écrit dans la bibliothèque de chants existante, sans la court-circuiter. */
export const SongLibraryLive = Layer.effect(
  SongLibrary,
  Effect.gen(function* () {
    const songs = yield* Songs;

    return SongLibrary.of({
      findByExternalId: (externalId) =>
        songs
          .findByExternalId(externalId)
          .pipe(Effect.map(Option.map((song) => ({ id: song.id, title: song.title })))),

      create: (song, externalId) =>
        songs
          .create(
            new SongInput({
              title: song.title,
              authors: song.authors,
              copyright: song.copyright,
              ccli: null,
              lyrics: song.lyrics,
            }),
            externalId,
          )
          .pipe(
            Effect.map((created) => created.id),
            // Paroles refusées : le fichier est signalé dans le rapport, l'import continue.
            Effect.catchTag("InvalidLyrics", () => Effect.succeed(null)),
          ),
    });
  }),
);

export const ProjectLibraryLive = Layer.effect(
  ProjectLibrary,
  Effect.gen(function* () {
    const projects = yield* Projects;

    return ProjectLibrary.of({
      create: (name) =>
        projects
          .create(new ProjectInput({ name, date: null }))
          .pipe(Effect.map((project) => project.id)),

      addSong: (projectId, songId) =>
        projects
          .addItem(projectId, { _tag: "Song", songId }, null)
          .pipe(Effect.asVoid, Effect.orDie),
    });
  }),
);
