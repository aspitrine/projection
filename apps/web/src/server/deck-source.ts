import { verseLabel } from "@projection/bible/domain";
import { Bible } from "@projection/bible/server";
import {
  Deck,
  DeckItem,
  type DeckItemKind,
  DeckSlide,
  LiveProjectNotFound,
} from "@projection/live/domain";
import { DeckSource } from "@projection/live/server";
import { Outputs } from "@projection/outputs/server";
import {
  ContentBlock,
  type Slide,
  type Splitting,
  scriptureSplitRules,
  songSplitRules,
  split,
} from "@projection/presentation/domain";
import type { ProjectItem } from "@projection/projects/domain";
import { Projects } from "@projection/projects/server";
import type { ProjectId } from "@projection/shared-kernel";
import { TextSlides } from "@projection/slides/server";
import { type Song, formatTag } from "@projection/songs/domain";
import { Songs } from "@projection/songs/server";
import { Effect, Layer } from "effect";

const toDeckSlide = (slide: Slide) =>
  new DeckSlide({
    content: { _tag: "Lines", lines: slide.lines, caption: slide.label },
    label: slide.parts > 1 ? `${slide.label ?? ""} (${slide.part}/${slide.parts})` : slide.label,
  });

const songSlides = (song: Song, splitting: Splitting) => {
  const sections = new Map(song.sections.map((section) => [section.id, section]));
  const blocks = song.arrangement.flatMap((id) => {
    const section = sections.get(id);
    return section === undefined
      ? []
      : [new ContentBlock({ key: section.id, label: formatTag(section), lines: section.lines })];
  });
  return split(blocks, songSplitRules(splitting.songMaxLines)).map(toDeckSlide);
};

const missingItem = (item: ProjectItem, kind: DeckItemKind, title = "") =>
  new DeckItem({ itemId: item.id, kind, title, missing: true, slides: [] });

/**
 * Résout un projet en diapos à partir des contextes songs, bible et slides,
 * avec le découpage de la piste Salle (contexte outputs).
 * Un contenu supprimé de la bibliothèque devient un élément « introuvable » sans diapo.
 */
export const DeckSourceLive = Layer.effect(
  DeckSource,
  Effect.gen(function* () {
    const projects = yield* Projects;
    const songs = yield* Songs;
    const bible = yield* Bible;
    const textSlides = yield* TextSlides;
    const outputs = yield* Outputs;

    const resolveItem = (splitting: Splitting) => (item: ProjectItem) => {
      switch (item._tag) {
        case "Song":
          return songs.get(item.songId).pipe(
            Effect.map(
              (song) =>
                new DeckItem({
                  itemId: item.id,
                  kind: "Song",
                  title: song.title,
                  missing: false,
                  slides: songSlides(song, splitting),
                }),
            ),
            Effect.catchTag("SongNotFound", () => Effect.succeed(missingItem(item, "Song"))),
          );
        case "Scripture":
          return bible.lookup(item.translationId, item.reference).pipe(
            Effect.map((passage) => {
              const blocks = passage.verses.map(
                (verse) =>
                  new ContentBlock({
                    key: `${verse.chapter}.${verse.verse}`,
                    label: verseLabel(verse),
                    lines: [verse.text],
                  }),
              );
              return new DeckItem({
                itemId: item.id,
                kind: "Scripture",
                title: `${passage.label} (${passage.translation.code})`,
                missing: false,
                slides: split(blocks, scriptureSplitRules(splitting.scriptureMaxCharacters)).map(
                  toDeckSlide,
                ),
              });
            }),
            Effect.catch(() => Effect.succeed(missingItem(item, "Scripture", item.reference))),
          );
        case "TextSlide":
          return textSlides.get(item.textSlideId).pipe(
            Effect.map(
              (slide) =>
                new DeckItem({
                  itemId: item.id,
                  kind: "TextSlide",
                  title: slide.title,
                  missing: false,
                  slides: [
                    new DeckSlide({
                      content: { _tag: "Rich", source: slide.source, caption: slide.title },
                      label: slide.title,
                    }),
                  ],
                }),
            ),
            Effect.catchTag("TextSlideNotFound", () =>
              Effect.succeed(missingItem(item, "TextSlide")),
            ),
          );
        case "Blank":
          return Effect.succeed(
            new DeckItem({
              itemId: item.id,
              kind: "Blank",
              title: "",
              missing: false,
              slides: [new DeckSlide({ content: { _tag: "Blank" }, label: null })],
            }),
          );
      }
    };

    return DeckSource.of({
      resolve: Effect.fn("DeckSource.resolve")(function* (projectId: ProjectId) {
        const project = yield* projects
          .get(projectId)
          .pipe(
            Effect.catchTag("ProjectNotFound", () =>
              Effect.fail(new LiveProjectNotFound({ projectId })),
            ),
          );
        // Les diapos de la régie suivent le découpage de la piste Salle.
        const { room } = yield* outputs.splitting;
        const items = yield* Effect.forEach(project.items, resolveItem(room), { concurrency: 4 });
        return new Deck({ projectId, projectName: project.name, items });
      }),
    });
  }),
);
