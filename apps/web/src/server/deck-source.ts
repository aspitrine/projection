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
import { MEDIA_DISPLAY_TTL_SECONDS } from "@projection/media/domain";
import { Media } from "@projection/media/server";
import type { SplittingSettings } from "@projection/outputs/domain";
import { Outputs } from "@projection/outputs/server";
import {
  ContentBlock,
  type FrameContent,
  type Slide,
  type SplitRules,
  idleVideo,
  scriptureSplitRules,
  songSplitRules,
  split,
  subSplit,
} from "@projection/presentation/domain";
import type { ProjectItem } from "@projection/projects/domain";
import { Projects } from "@projection/projects/server";
import type { ProjectId } from "@projection/shared-kernel";
import { TextSlides } from "@projection/slides/server";
import { type Song, formatTag } from "@projection/songs/domain";
import { Songs } from "@projection/songs/server";
import { Effect, Layer } from "effect";

/** Diapo de salle et ses parties pour la piste Stream (sous-découpage). */
const toDeckSlide = (streamRules: SplitRules, sectioned: boolean) => (slide: Slide) => {
  const content: FrameContent = { _tag: "Lines", lines: slide.lines, caption: slide.label };
  return deckSlide(slide, sectioned, content, streamRules);
};

/** Verset : la référence est affichée à part sur les écrans, pas en libellé de section. */
const toScriptureSlide = (streamRules: SplitRules) => (slide: Slide) => {
  const content: FrameContent = {
    _tag: "Lines",
    lines: slide.lines,
    caption: null,
    ...(slide.label === null ? {} : { reference: slide.label }),
  };
  return deckSlide(slide, false, content, streamRules);
};

const deckSlide = (
  slide: Slide,
  sectioned: boolean,
  content: FrameContent,
  streamRules: SplitRules,
) => {
  return new DeckSlide({
    content,
    label: slide.parts > 1 ? `${slide.label ?? ""} (${slide.part}/${slide.parts})` : slide.label,
    sectionId: sectioned ? (slide.blockKeys[0] ?? null) : null,
    parts: subSplit(content, streamRules),
  });
};

/** Diapo non découpable (texte enrichi, écran vide) : une seule partie. */
const wholeSlide = (content: FrameContent, label: string | null) =>
  new DeckSlide({ content, label, sectionId: null, parts: [content] });

const songSlides = (song: Song, splitting: SplittingSettings) => {
  const sections = new Map(song.sections.map((section) => [section.id, section]));
  const blocks = song.arrangement.flatMap((id) => {
    const section = sections.get(id);
    return section === undefined
      ? []
      : [new ContentBlock({ key: section.id, label: formatTag(section), lines: section.lines })];
  });
  return split(blocks, songSplitRules(splitting.room.songMaxLines)).map(
    toDeckSlide(songSplitRules(splitting.stream.songMaxLines), true),
  );
};

/** Notes de conduite saisies sur l'élément de projet. */
const notesOf = (item: ProjectItem) => item.notes ?? null;

const missingItem = (item: ProjectItem, kind: DeckItemKind, title = "") =>
  new DeckItem({
    itemId: item.id,
    kind,
    title,
    sourceId: null,
    notes: notesOf(item),
    missing: true,
    slides: [],
  });

/**
 * Résout un projet en diapos à partir des contextes songs, bible et slides, avec le
 * découpage de la piste Salle et le sous-découpage de la piste Stream (contexte outputs).
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
    const media = yield* Media;

    const resolveItem = (splitting: SplittingSettings) => (item: ProjectItem) => {
      switch (item._tag) {
        case "Song":
          return songs.get(item.songId).pipe(
            Effect.map(
              (song) =>
                new DeckItem({
                  itemId: item.id,
                  kind: "Song",
                  sourceId: song.id,
                  title: song.title,
                  notes: notesOf(item),
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
                sourceId: null,
                title: `${passage.label} (${passage.translation.code})`,
                notes: notesOf(item),
                missing: false,
                slides: split(
                  blocks,
                  scriptureSplitRules(splitting.room.scriptureMaxCharacters),
                ).map(
                  toScriptureSlide(scriptureSplitRules(splitting.stream.scriptureMaxCharacters)),
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
                  sourceId: slide.id,
                  title: slide.title,
                  notes: notesOf(item),
                  missing: false,
                  slides: [
                    wholeSlide(
                      {
                        _tag: "Rich",
                        source: slide.source,
                        layout: slide.layout,
                        caption: slide.title,
                      },
                      slide.title,
                    ),
                  ],
                }),
            ),
            Effect.catchTag("TextSlideNotFound", () =>
              Effect.succeed(missingItem(item, "TextSlide")),
            ),
          );
        case "Media":
          return Effect.all([
            media.get(item.mediaId),
            media.url(item.mediaId, MEDIA_DISPLAY_TTL_SECONDS),
          ]).pipe(
            Effect.map(([asset, url]) => {
              const content: FrameContent =
                asset.kind === "image"
                  ? { _tag: "Image", url, caption: asset.name }
                  : { _tag: "Video", url, caption: asset.name, playback: idleVideo };
              return new DeckItem({
                itemId: item.id,
                kind: "Media",
                title: asset.name,
                sourceId: asset.id,
                notes: notesOf(item),
                missing: false,
                slides: [wholeSlide(content, asset.name)],
              });
            }),
            Effect.catchTag("MediaNotFound", () => Effect.succeed(missingItem(item, "Media"))),
          );
        case "Blank":
          return Effect.succeed(
            new DeckItem({
              itemId: item.id,
              kind: "Blank",
              sourceId: null,
              title: "",
              notes: notesOf(item),
              missing: false,
              slides: [wholeSlide({ _tag: "Blank" }, null)],
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
        const splitting = yield* outputs.splitting;
        const items = yield* Effect.forEach(project.items, resolveItem(splitting), {
          concurrency: 4,
        });
        return new Deck({ projectId, projectName: project.name, items });
      }),
    });
  }),
);
