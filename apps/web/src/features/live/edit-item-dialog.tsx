import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { SlideLayout } from "@projection/presentation/domain";
import type { ProjectItem } from "@projection/projects/domain";
import type { ProjectId } from "@projection/shared-kernel";
import { type Song, formatLyrics, parseLyrics } from "@projection/songs/domain";
import { hasVisibleContent, type TextSlide } from "@projection/slides/domain";
import { Button } from "@projection/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@projection/ui/components/dialog";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { Effect, Exit } from "effect";
import { Pencil } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { passageAtom, passageKey, translationsAtom } from "@/features/bible/atoms";
import { liveRefreshAtom } from "@/features/live/atoms";
import { projectsReactivity, replaceItemAtom } from "@/features/projects/atoms";
import { RichTextEditor } from "@/features/slides/rich-text-editor";
import { slideAtom, slidesReactivity, updateSlideAtom } from "@/features/slides/atoms";
import { type SlideFormValues, toSlideInput } from "@/features/slides/slide-editor";
import { LyricsEditor } from "@/features/songs/lyrics-editor";
import { songAtom, songsReactivity, updateSongAtom } from "@/features/songs/atoms";
import { type SongFormValues, toSongInput } from "@/features/songs/song-editor";
import { m } from "@/paraglide/messages";

type EditableItem = Extract<ProjectItem, { _tag: "Song" | "Scripture" | "TextSlide" }>;

export function EditItemDialog({ projectId, item }: { projectId: ProjectId; item: EditableItem }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-4" aria-hidden />
        {m.live_edit_item()}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,56rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{m.live_edit_item_title()}</DialogTitle>
            <DialogDescription>
              {item._tag === "Scripture"
                ? m.live_edit_scripture_description()
                : m.live_edit_content_description()}
            </DialogDescription>
          </DialogHeader>
          {item._tag === "Song" ? (
            <SongContentEditor item={item} onDone={() => setOpen(false)} />
          ) : item._tag === "TextSlide" ? (
            <SlideContentEditor item={item} onDone={() => setOpen(false)} />
          ) : (
            <ScriptureReplacement projectId={projectId} item={item} onDone={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SongContentEditor({
  item,
  onDone,
}: {
  item: Extract<ProjectItem, { _tag: "Song" }>;
  onDone: () => void;
}) {
  const result = useAtomValue(songAtom(item.songId));
  if (result._tag === "Initial") return <p className="text-muted-foreground text-sm">…</p>;
  if (result._tag === "Failure") {
    return <p className="text-sm text-red-500">{m.songs_load_error()}</p>;
  }
  return <SongContentForm key={result.value.id} song={result.value} onDone={onDone} />;
}

function SongContentForm({ song, onDone }: { song: Song; onDone: () => void }) {
  const update = useAtomSet(updateSongAtom, { mode: "promiseExit" });
  const refresh = useAtomSet(liveRefreshAtom, { mode: "promiseExit" });
  const [values, setValues] = useState<SongFormValues>({
    title: song.title,
    authors: song.authors ?? "",
    copyright: song.copyright ?? "",
    ccli: song.ccli ?? "",
    lyrics: formatLyrics(song),
  });
  const [pending, setPending] = useState(false);
  const parsedLyrics = useMemo(
    () => Effect.runSyncExit(parseLyrics(values.lyrics)),
    [values.lyrics],
  );
  const valid = values.title.trim() !== "" && Exit.isSuccess(parsedLyrics);

  const save = async () => {
    if (!valid) return;
    setPending(true);
    const exit = await update({
      payload: { id: song.id, input: toSongInput(values) },
      reactivityKeys: songsReactivity,
    });
    if (Exit.isFailure(exit)) {
      setPending(false);
      return toast.error(m.live_edit_content_failed());
    }
    await refresh({ payload: undefined });
    setPending(false);
    toast.success(m.live_edit_content_saved());
    onDone();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="live-song-title">{m.song_field_title()}</Label>
          <Input
            id="live-song-title"
            required
            value={values.title}
            onChange={(event) =>
              setValues((current) => ({ ...current, title: event.target.value }))
            }
          />
        </div>
        <SongField
          id="live-song-authors"
          label={m.song_field_authors()}
          value={values.authors}
          onChange={(authors) => setValues((current) => ({ ...current, authors }))}
        />
        <SongField
          id="live-song-copyright"
          label={m.song_field_copyright()}
          value={values.copyright}
          onChange={(copyright) => setValues((current) => ({ ...current, copyright }))}
        />
        <SongField
          id="live-song-ccli"
          label={m.song_field_ccli()}
          value={values.ccli}
          onChange={(ccli) => setValues((current) => ({ ...current, ccli }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label id="live-song-lyrics-label">{m.song_field_lyrics()}</Label>
        <LyricsEditor
          value={values.lyrics}
          labelledBy="live-song-lyrics-label"
          describedBy="live-song-lyrics-help"
          invalid={!Exit.isSuccess(parsedLyrics)}
          onChange={(lyrics) => setValues((current) => ({ ...current, lyrics }))}
        />
        <p id="live-song-lyrics-help" className="text-muted-foreground text-xs">
          {m.song_lyrics_help()}
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={!valid || pending}>
          {m.song_save()}
        </Button>
      </div>
    </form>
  );
}

function SongField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SlideContentEditor({
  item,
  onDone,
}: {
  item: Extract<ProjectItem, { _tag: "TextSlide" }>;
  onDone: () => void;
}) {
  const result = useAtomValue(slideAtom(item.textSlideId));
  if (result._tag === "Initial") return <p className="text-muted-foreground text-sm">…</p>;
  if (result._tag === "Failure") {
    return <p className="text-sm text-red-500">{m.slides_load_error()}</p>;
  }
  return <SlideContentForm key={result.value.id} slide={result.value} onDone={onDone} />;
}

const layouts: ReadonlyArray<{ value: SlideLayout; label: () => string }> = [
  { value: "free", label: m.slide_layout_free },
  { value: "title", label: m.slide_layout_title },
  { value: "titleBody", label: m.slide_layout_titleBody },
  { value: "quote", label: m.slide_layout_quote },
];

function SlideContentForm({ slide, onDone }: { slide: TextSlide; onDone: () => void }) {
  const update = useAtomSet(updateSlideAtom, { mode: "promiseExit" });
  const refresh = useAtomSet(liveRefreshAtom, { mode: "promiseExit" });
  const [values, setValues] = useState<SlideFormValues>({
    title: slide.title,
    source: slide.source,
    layout: slide.layout,
  });
  const [pending, setPending] = useState(false);
  const valid = values.title.trim() !== "" && hasVisibleContent(values.source);

  const save = async () => {
    if (!valid) return;
    setPending(true);
    const exit = await update({
      payload: { id: slide.id, input: toSlideInput(values) },
      reactivityKeys: slidesReactivity,
    });
    if (Exit.isFailure(exit)) {
      setPending(false);
      return toast.error(m.live_edit_content_failed());
    }
    await refresh({ payload: undefined });
    setPending(false);
    toast.success(m.live_edit_content_saved());
    onDone();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="live-slide-title">{m.slide_field_title()}</Label>
        <Input
          id="live-slide-title"
          required
          value={values.title}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label id="live-slide-source-label">{m.slide_field_content()}</Label>
        <RichTextEditor
          value={values.source}
          labelledBy="live-slide-source-label"
          describedBy="live-slide-source-help"
          onChange={(source) => setValues((current) => ({ ...current, source }))}
        />
        <p id="live-slide-source-help" className="text-muted-foreground text-xs">
          {m.slide_help()}
        </p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{m.slide_field_layout()}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {layouts.map((layout) => (
            <Button
              key={layout.value}
              type="button"
              role="radio"
              aria-checked={values.layout === layout.value}
              size="sm"
              variant={values.layout === layout.value ? "default" : "outline"}
              onClick={() => setValues((current) => ({ ...current, layout: layout.value }))}
            >
              {layout.label()}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" disabled={!valid || pending}>
          {m.slide_save()}
        </Button>
      </div>
    </form>
  );
}

function ScriptureReplacement({
  projectId,
  item,
  onDone,
}: {
  projectId: ProjectId;
  item: Extract<ProjectItem, { _tag: "Scripture" }>;
  onDone: () => void;
}) {
  const translations = useAtomValue(translationsAtom);
  const [translationId, setTranslationId] = useState(item.translationId);
  const [reference, setReference] = useState(item.reference);
  const [pending, setPending] = useState(false);
  const deferredReference = useDeferredValue(reference);
  const passage = useAtomValue(passageAtom(passageKey(translationId, deferredReference)));
  const replace = useAtomSet(replaceItemAtom, { mode: "promiseExit" });

  useEffect(() => {
    setTranslationId(item.translationId);
    setReference(item.reference);
  }, [item.id, item.reference, item.translationId]);

  const save = async () => {
    if (passage._tag !== "Success") return;
    setPending(true);
    const exit = await replace({
      payload: {
        projectId,
        itemId: item.id,
        item: { _tag: "Scripture", translationId, reference: passage.value.label },
      },
      reactivityKeys: projectsReactivity,
    });
    setPending(false);
    if (Exit.isFailure(exit)) return toast.error(m.live_edit_item_failed());
    toast.success(m.live_edit_item_saved());
    onDone();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="edit-scripture-translation">{m.bible_translation()}</Label>
        <select
          id="edit-scripture-translation"
          className="border-input bg-background h-9 w-full border px-3 text-sm"
          value={translationId}
          onChange={(event) => setTranslationId(event.target.value)}
        >
          {translations._tag === "Success" &&
            translations.value.map((translation) => (
              <option key={translation.id} value={translation.id}>
                {translation.name}
              </option>
            ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-scripture-reference">{m.bible_reference()}</Label>
        <Input
          id="edit-scripture-reference"
          autoComplete="off"
          placeholder={m.bible_reference_placeholder()}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
      </div>
      {passage._tag === "Initial" ? (
        <p className="text-muted-foreground text-sm">…</p>
      ) : passage._tag === "Failure" ? (
        <p role="alert" className="text-sm text-red-500">
          {m.bible_error_malformed()}
        </p>
      ) : (
        <div className="space-y-1 border p-3 text-sm">
          <p className="font-medium">{passage.value.label}</p>
          <p className="text-muted-foreground">
            {m.bible_verses({ count: passage.value.verses.length })}
          </p>
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={passage._tag !== "Success" || pending}>
          {m.live_edit_item_replace()}
        </Button>
      </div>
    </form>
  );
}
