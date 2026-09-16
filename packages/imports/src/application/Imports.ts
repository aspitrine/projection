import { CurrentActor, type ProjectId, type SongId } from "@projection/shared-kernel";
import { Context, Effect, Layer, Option } from "effect";

import { AgendaImportReport } from "../domain/Report";
import { type InvalidVideoPsalm, parseVideoPsalmAgenda } from "../domain/VideoPsalm";
import { ProjectLibrary, SongLibrary } from "./ports";

/** Nom du projet : celui du fichier, sans extension. */
export const projectNameFrom = (fileName: string) => {
  const withoutExtension = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return withoutExtension === "" ? "Agenda importé" : withoutExtension;
};

/** Import d'agendas d'autres logiciels vers la bibliothèque et les projets. */
export class Imports extends Context.Service<
  Imports,
  {
    /**
     * Crée les chants absents (dédoublonnés par identifiant d'origine) puis un projet
     * reprenant l'ordre de l'agenda.
     */
    importVideoPsalm(
      fileName: string,
      archive: Uint8Array,
    ): Effect.Effect<AgendaImportReport, InvalidVideoPsalm, CurrentActor>;
  }
>()("@projection/imports/Imports") {
  static readonly layer = Layer.effect(
    Imports,
    Effect.gen(function* () {
      const songs = yield* SongLibrary;
      const projects = yield* ProjectLibrary;

      return Imports.of({
        importVideoPsalm: Effect.fn("Imports.importVideoPsalm")(function* (
          fileName: string,
          archive: Uint8Array,
        ) {
          const agenda = parseVideoPsalmAgenda(archive);
          if ("_tag" in agenda) return yield* agenda;

          const projectName = projectNameFrom(fileName);
          const projectId: ProjectId = yield* projects.create(projectName);
          const imported: Array<{ id: SongId; title: string }> = [];
          const reused: Array<{ id: SongId; title: string }> = [];
          const errors: Array<{ title: string }> = [];

          for (const song of agenda.songs) {
            const externalId = `videopsalm:${song.externalId}`;
            const existing = yield* songs.findByExternalId(externalId);

            const id = yield* Option.match(existing, {
              onSome: (found) =>
                Effect.sync(() => {
                  reused.push({ id: found.id, title: found.title });
                  return found.id;
                }),
              onNone: () =>
                songs.create(song, externalId).pipe(
                  Effect.map((created) => {
                    if (created === null) {
                      errors.push({ title: song.title });
                      return null;
                    }
                    imported.push({ id: created, title: song.title });
                    return created;
                  }),
                ),
            });

            if (id !== null) yield* projects.addSong(projectId, id);
          }

          return new AgendaImportReport({ projectId, projectName, imported, reused, errors });
        }),
      });
    }),
  );
}
