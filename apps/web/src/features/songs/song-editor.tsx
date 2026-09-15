import { songSplitRules, split } from "@projection/presentation/domain";
import { parseLyrics } from "@projection/songs/domain";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { Link } from "@tanstack/react-router";
import { Effect, Exit, Option } from "effect";
import { ArrowLeft } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { SlidePreviewGrid } from "@/features/presentation/slide-preview-grid";
import { m } from "@/paraglide/messages";

import { lyricsErrorMessage } from "./errors";
import { LyricsEditor } from "./lyrics-editor";
import { PREVIEW_MAX_LINES, sectionLabel, toContentBlocks } from "./sections";

export interface SongFormValues {
  readonly title: string;
  readonly authors: string;
  readonly copyright: string;
  readonly ccli: string;
  readonly lyrics: string;
}

export const emptySongForm: SongFormValues = {
  title: "",
  authors: "",
  copyright: "",
  ccli: "",
  lyrics: "",
};

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

export const toSongInput = (values: SongFormValues) => ({
  title: values.title.trim(),
  authors: orNull(values.authors),
  copyright: orNull(values.copyright),
  ccli: orNull(values.ccli),
  lyrics: values.lyrics,
});

const fields = [
  { name: "title", label: m.song_field_title },
  { name: "authors", label: m.song_field_authors },
  { name: "copyright", label: m.song_field_copyright },
  { name: "ccli", label: m.song_field_ccli },
] as const;

export function SongEditor({
  heading,
  initial,
  submitting,
  onSubmit,
  actions,
}: {
  heading: string;
  initial: SongFormValues;
  submitting: boolean;
  onSubmit: (values: SongFormValues) => void;
  actions?: ReactNode;
}) {
  const [values, setValues] = useState(initial);
  const set = (name: keyof SongFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  const hasLyrics = values.lyrics.trim() !== "";
  const parsed = useMemo(() => Effect.runSyncExit(parseLyrics(values.lyrics)), [values.lyrics]);
  const lyrics = Exit.isSuccess(parsed) ? parsed.value : null;
  const lyricsError = hasLyrics ? Option.getOrNull(Exit.findErrorOption(parsed)) : null;
  const slides = useMemo(
    () => (lyrics ? split(toContentBlocks(lyrics), songSplitRules(PREVIEW_MAX_LINES)) : []),
    [lyrics],
  );
  const sectionsById = new Map(lyrics?.sections.map((section) => [section.id, section]));

  const titleMissing = values.title.trim() === "";
  const canSubmit = !titleMissing && lyrics !== null && !submitting;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <Link
          to="/library/songs"
          className={buttonVariants({ variant: "link", className: "px-0" })}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {m.song_back()}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{heading}</h1>
          {actions}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit(values);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ name, label }) => (
              <div
                key={name}
                className={name === "title" ? "space-y-2 sm:col-span-2" : "space-y-2"}
              >
                <Label htmlFor={`song-${name}`}>{label()}</Label>
                <Input
                  id={`song-${name}`}
                  value={values[name]}
                  required={name === "title"}
                  onChange={(event) => set(name)(event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label id="song-lyrics-label">{m.song_field_lyrics()}</Label>
            <p id="song-lyrics-help" className="text-muted-foreground text-xs">
              {m.song_lyrics_help()}
            </p>
            <LyricsEditor
              value={values.lyrics}
              labelledBy="song-lyrics-label"
              describedBy="song-lyrics-help"
              invalid={lyricsError !== null}
              onChange={set("lyrics")}
            />
            {lyricsError && (
              <p role="alert" className="text-sm text-red-500">
                {lyricsErrorMessage(lyricsError)}
              </p>
            )}
          </div>

          <Button type="submit" disabled={!canSubmit}>
            {submitting ? m.song_saving() : m.song_save()}
          </Button>
        </form>

        <section className="space-y-4" aria-label={m.song_preview()}>
          <h2 className="font-medium">{m.song_preview()}</h2>
          {lyrics === null ? (
            <p className="text-muted-foreground text-sm">{m.song_lyrics_empty()}</p>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="text-muted-foreground text-xs font-medium uppercase">
                  {m.song_arrangement()}
                </h3>
                <ol className="flex flex-wrap gap-1" data-testid="song-arrangement">
                  {lyrics.arrangement.map((id, index) => {
                    const section = sectionsById.get(id);
                    return (
                      <li key={`${id}-${index}`} className="bg-muted px-2 py-0.5 text-xs">
                        {section ? sectionLabel(section) : id}
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="space-y-2">
                <h3 className="text-muted-foreground text-xs font-medium uppercase">
                  {m.song_slides({ count: slides.length })}
                </h3>
                <SlidePreviewGrid slides={slides} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
