import { useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  type Deck,
  type DeckItem,
  type LiveCursor,
  type LiveSession,
  type LiveSnapshot,
  type StreamCursor,
  type StreamOverride,
  contentAt,
  nextCursor,
  streamFrameContent,
} from "@projection/live/domain";
import {
  type Cover,
  type FrameContent,
  remainingMs,
  type Track,
  type VideoPlayback,
  videoPositionMs,
} from "@projection/presentation/domain";
import type { ProjectItemId, SongId } from "@projection/shared-kernel";
import { formatTag } from "@projection/songs/domain";
import { Button } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Textarea } from "@projection/ui/components/textarea";
import { cn } from "@projection/ui/lib/utils";
import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";
import { Exit } from "effect";
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  ImageIcon,
  MonitorOff,
  Radio,
  Pause,
  Pencil,
  Play,
  RotateCcw as RotateIcon,
  RotateCcw,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { contentToSlide, roomTheme } from "@/features/display/frame";
import { FrameView } from "@/features/display/frame-view";
import { formatDuration, useNow } from "@/features/display/time";
import {
  liveAtom,
  liveEditSectionAtom,
  liveGoToAtom,
  liveNextAtom,
  livePreviousAtom,
  liveRefreshAtom,
  liveSetCoverAtom,
  liveStartAtom,
  liveStopAtom,
  liveStreamGoToAtom,
  liveStreamNextAtom,
  liveStreamPreviousAtom,
  liveStreamResumeAtom,
  liveStreamSetLinkedAtom,
  liveStreamShowLinesAtom,
  liveTimerPauseAtom,
  liveTimerResetAtom,
  liveTimerSetAtom,
  liveTimerStartAtom,
  liveVideoPauseAtom,
  liveVideoPlayAtom,
  liveVideoRestartAtom,
} from "@/features/live/atoms";
import { SlideRenderer } from "@/features/presentation/slide-renderer";
import { projectAtom, projectsListAtom } from "@/features/projects/atoms";
import { songAtom } from "@/features/songs/atoms";
import { formatProjectDate } from "@/features/projects/format";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/live")({
  component: () => (
    <ClientOnly fallback={<Loader />}>
      <LivePage />
    </ClientOnly>
  ),
});

/** Damier derrière l'aperçu stream : rend la transparence visible. */
const transparencyBackground = {
  backgroundImage: "repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%)",
  backgroundSize: "16px 16px",
} as const;

const partSummary = (content: FrameContent) =>
  content._tag === "Lines" ? content.lines.join(" / ") : content._tag === "Rich" ? "…" : "—";

/** Lance une commande et signale un échec (l'état arrive par le flux de la régie). */
function useRun() {
  return useCallback(async (action: Promise<Exit.Exit<unknown, unknown>>) => {
    if (Exit.isFailure(await action)) toast.error(m.live_action_error());
  }, []);
}

function LivePage() {
  const result = useAtomValue(liveAtom);
  if (result._tag === "Initial") return <Loader />;
  if (result._tag === "Failure") {
    return <p className="p-6 text-sm text-red-500">{m.live_load_error()}</p>;
  }
  const snapshot = result.value;
  return snapshot.deck === null ? (
    <ProjectPicker />
  ) : (
    <Regie snapshot={snapshot} deck={snapshot.deck} />
  );
}

function ProjectPicker() {
  const projects = useAtomValue(projectsListAtom);
  const start = useAtomSet(liveStartAtom, { mode: "promiseExit" });
  const run = useRun();

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{m.nav_live()}</h1>
        <p className="text-muted-foreground text-sm">{m.live_pick_project()}</p>
      </div>
      {projects._tag !== "Success" ? (
        <Loader />
      ) : projects.value.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {m.live_no_projects()}{" "}
          <Link to="/projects" className="underline">
            {m.nav_projects()}
          </Link>
        </p>
      ) : (
        <ul className="divide-y border" data-testid="live-projects">
          {projects.value.map((project) => (
            <li key={project.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{project.name}</p>
                <p className="text-muted-foreground text-xs">
                  {project.date === null ? m.projects_no_date() : formatProjectDate(project.date)}
                  {" · "}
                  {m.live_item_count({ count: project.itemCount })}
                </p>
              </div>
              <Button size="sm" onClick={() => run(start({ payload: { projectId: project.id } }))}>
                <Radio className="size-4" aria-hidden />
                {m.live_start()}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Champs de saisie : les raccourcis n'y sont pas interceptés (une case à cocher ne compte pas). */
const nonTextInputs = new Set(["checkbox", "radio", "button", "submit", "reset", "range"]);

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["TEXTAREA", "SELECT"].includes(target.tagName) ||
    (target instanceof HTMLInputElement && !nonTextInputs.has(target.type)));

function Regie({ snapshot, deck }: { snapshot: LiveSnapshot; deck: Deck }) {
  const { session } = snapshot;
  const run = useRun();
  const goTo = useAtomSet(liveGoToAtom, { mode: "promiseExit" });
  const next = useAtomSet(liveNextAtom, { mode: "promiseExit" });
  const previous = useAtomSet(livePreviousAtom, { mode: "promiseExit" });
  const setCover = useAtomSet(liveSetCoverAtom, { mode: "promiseExit" });
  const refresh = useAtomSet(liveRefreshAtom, { mode: "promiseExit" });
  const stop = useAtomSet(liveStopAtom, { mode: "promiseExit" });
  const streamGoTo = useAtomSet(liveStreamGoToAtom, { mode: "promiseExit" });
  const streamNext = useAtomSet(liveStreamNextAtom, { mode: "promiseExit" });
  const streamPrevious = useAtomSet(liveStreamPreviousAtom, { mode: "promiseExit" });

  const covers = useRef({ room: session.roomCover, stream: session.streamCover });
  covers.current = { room: session.roomCover, stream: session.streamCover };

  // Projet modifié (élément ajouté, réordonné…) : la régie relit le projet sans perdre sa position.
  const project = useAtomValue(projectAtom(deck.projectId));
  const projectVersion = project._tag === "Success" ? project.value.updatedAt : null;
  useEffect(() => {
    if (projectVersion !== null) void run(refresh({ payload: undefined }));
  }, [projectVersion, refresh, run]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      // Espace sur un bouton ou une case : comportement natif (activer, cocher).
      if (
        event.key === " " &&
        (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement)
      )
        return;
      const forward = ["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key);
      const backward = ["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key);
      if (event.shiftKey && forward) {
        void run(streamNext({ payload: undefined }));
      } else if (event.shiftKey && backward) {
        void run(streamPrevious({ payload: undefined }));
      } else if (forward) {
        void run(next({ payload: undefined }));
      } else if (backward) {
        void run(previous({ payload: undefined }));
      } else if (event.key === "b" || event.key === "B") {
        const track: Track = event.shiftKey ? "stream" : "room";
        const cover: Cover = covers.current[track] === "black" ? "none" : "black";
        void run(setCover({ payload: { track, cover } }));
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, setCover, streamNext, streamPrevious, run]);

  // Paroles mises à jour par un autre opérateur : on prévient une seule fois.
  const noticedEdit = useRef<number | null>(null);
  useEffect(() => {
    const edit = snapshot.lastEdit;
    if (edit === null || noticedEdit.current === edit.at) return;
    noticedEdit.current = edit.at;
    toast.info(m.live_edit_notice({ title: edit.title, section: edit.section }));
  }, [snapshot.lastEdit]);

  const currentItem =
    session.cursor === null
      ? null
      : (deck.items.find((item) => item.itemId === session.cursor?.itemId) ?? null);
  const currentSection =
    currentItem === null || session.cursor === null
      ? null
      : (currentItem.slides[session.cursor.slideIndex]?.sectionId ?? null);

  const current = contentAt(deck, session.cursor);
  const upcomingCursor = session.cursor === null ? null : nextCursor(deck, session.cursor);
  const hasUpcoming =
    upcomingCursor !== null &&
    (upcomingCursor.itemId !== session.cursor?.itemId ||
      upcomingCursor.slideIndex !== session.cursor.slideIndex);

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4 p-4 lg:overflow-y-auto">
        <header className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs uppercase">{m.nav_live()}</p>
            <h1 className="truncate text-xl font-semibold">{deck.projectName}</h1>
          </div>
          <Button variant="outline" onClick={() => run(previous({ payload: undefined }))}>
            <ChevronLeft className="size-4" aria-hidden />
            {m.live_previous()}
          </Button>
          <Button onClick={() => run(next({ payload: undefined }))}>
            {m.live_next()}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          <CoverButtons track="room" cover={session.roomCover} />
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(m.live_stop_confirm())) void run(stop({ payload: undefined }));
            }}
          >
            <Square className="size-4" aria-hidden />
            {m.live_stop()}
          </Button>
        </header>
        <p className="text-muted-foreground text-xs">{m.live_shortcuts()}</p>
        <DeckView
          deck={deck}
          cursor={session.cursor}
          streamCursor={session.streamCursor}
          onPick={(itemId, slideIndex) => run(goTo({ payload: { itemId, slideIndex } }))}
          onPickStream={(itemId, slideIndex) =>
            run(streamGoTo({ payload: { itemId, slideIndex, part: 0 } }))
          }
        />
      </div>

      <aside className="bg-card space-y-4 border-t p-4 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l xl:w-96">
        <section className="space-y-1">
          <h2 className="text-muted-foreground text-xs font-medium uppercase">
            {m.live_room()} · {m.live_screen()}
          </h2>
          <CoverPreview
            testId="live-screen"
            track="room"
            cover={session.roomCover}
            content={current}
            ringClassName="ring-green-600"
          />
        </section>
        <section className="space-y-1">
          <h2 className="text-muted-foreground text-xs font-medium uppercase">
            {m.live_next_preview()}
          </h2>
          {hasUpcoming ? (
            <div className="opacity-80 ring-1 ring-foreground/10">
              <SlideRenderer
                theme={roomTheme}
                slide={contentToSlide(contentAt(deck, upcomingCursor))}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">{m.live_end()}</p>
          )}
        </section>
        {currentItem !== null && currentItem.sourceId !== null && currentSection !== null && (
          <LyricsPanel
            key={`${currentItem.itemId}:${currentSection}`}
            itemId={currentItem.itemId}
            songId={currentItem.sourceId}
            sectionId={currentSection}
          />
        )}
        {current._tag === "Video" && <VideoPanel playback={snapshot.video} />}
        <StagePanel session={session} deck={deck} />
        <StreamPanel snapshot={snapshot} deck={deck} />
        <Link to="/outputs" className="text-muted-foreground block text-xs underline">
          {m.live_outputs_link()}
        </Link>
      </aside>
    </div>
  );
}

/** Édition en direct de la section projetée : enregistrée en bibliothèque puis diffusée. */
function LyricsPanel({
  itemId,
  songId,
  sectionId,
}: {
  itemId: ProjectItemId;
  songId: string;
  sectionId: string;
}) {
  const song = useAtomValue(songAtom(songId as SongId));
  const editSection = useAtomSet(liveEditSectionAtom, { mode: "promiseExit" });
  const [draft, setDraft] = useState<string | null>(null);

  const section =
    song._tag === "Success"
      ? (song.value.sections.find((candidate) => candidate.id === sectionId) ?? null)
      : null;
  if (section === null) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-xs font-medium uppercase">
          {m.live_edit_section({ section: formatTag(section) })}
        </h2>
        <Button
          size="sm"
          variant="outline"
          aria-expanded={draft !== null}
          onClick={() => setDraft(draft === null ? section.lines.join("\n") : null)}
        >
          <Pencil className="size-4" aria-hidden />
          {m.live_edit_lyrics()}
        </Button>
      </div>

      {draft !== null && (
        <div className="space-y-2">
          <Textarea
            aria-label={m.live_edit_lyrics()}
            className="min-h-32 text-sm"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                const lines = draft.split("\n");
                const exit = await editSection({ payload: { itemId, sectionId, lines } });
                if (Exit.isSuccess(exit)) {
                  toast.success(m.live_edit_saved());
                  setDraft(null);
                } else {
                  toast.error(m.live_edit_failed());
                }
              }}
            >
              {m.live_edit_save()}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {m.live_edit_cancel()}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Lecture de la vidéo projetée : tous les écrans suivent ces commandes. */
function VideoPanel({ playback }: { playback: VideoPlayback }) {
  const run = useRun();
  const play = useAtomSet(liveVideoPlayAtom, { mode: "promiseExit" });
  const pause = useAtomSet(liveVideoPauseAtom, { mode: "promiseExit" });
  const restart = useAtomSet(liveVideoRestartAtom, { mode: "promiseExit" });
  const now = useNow();

  return (
    <section className="space-y-2" data-testid="live-video">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-xs font-medium uppercase">{m.live_video()}</h2>
        <span className="text-xs tabular-nums" data-testid="live-video-position">
          {playback.playing ? m.live_video_playing() : m.live_video_paused()} ·{" "}
          {formatDuration(videoPositionMs(playback, now))}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() =>
            run(playback.playing ? pause({ payload: undefined }) : play({ payload: undefined }))
          }
        >
          {playback.playing ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
          {playback.playing ? m.live_video_pause() : m.live_video_play()}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => run(restart({ payload: undefined }))}
          aria-label={m.live_video_restart()}
        >
          <RotateIcon className="size-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}

/** Retour scène : notes de l'élément en cours et minuteur piloté depuis la régie. */
function StagePanel({ session, deck }: { session: LiveSession; deck: Deck }) {
  const run = useRun();
  const now = useNow();
  const setTimer = useAtomSet(liveTimerSetAtom, { mode: "promiseExit" });
  const startTimer = useAtomSet(liveTimerStartAtom, { mode: "promiseExit" });
  const pauseTimer = useAtomSet(liveTimerPauseAtom, { mode: "promiseExit" });
  const resetTimer = useAtomSet(liveTimerResetAtom, { mode: "promiseExit" });
  const [minutes, setMinutes] = useState(5);

  const notes =
    session.cursor === null
      ? null
      : (deck.items.find((item) => item.itemId === session.cursor?.itemId)?.notes ?? null);
  const remaining = remainingMs(session.timer, now);
  const running = session.timer.runningSince !== null;

  return (
    <section className="space-y-2" data-testid="live-stage">
      <h2 className="text-muted-foreground text-xs font-medium uppercase">{m.live_stage()}</h2>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex-1 text-2xl font-semibold tabular-nums",
            session.timer.durationMs === 0 && "text-muted-foreground",
            remaining < 0 && "text-red-500",
          )}
          data-testid="live-timer"
        >
          {formatDuration(remaining)}
        </span>
        <Button
          size="sm"
          variant="outline"
          aria-label={running ? m.live_timer_pause() : m.live_timer_start()}
          disabled={session.timer.durationMs === 0}
          onClick={() =>
            run(running ? pauseTimer({ payload: undefined }) : startTimer({ payload: undefined }))
          }
        >
          {running ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={m.live_timer_reset()}
          onClick={() => run(resetTimer({ payload: undefined }))}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(setTimer({ payload: { durationMs: Math.round(minutes * 60_000) } }));
        }}
      >
        <Input
          type="number"
          min={0}
          max={180}
          step={1}
          className="h-8 w-20"
          aria-label={m.live_timer_minutes()}
          value={minutes}
          onChange={(event) => setMinutes(event.target.valueAsNumber || 0)}
        />
        <Button type="submit" size="sm" variant="outline">
          {m.live_timer_set()}
        </Button>
      </form>

      <div className="space-y-1">
        <h3 className="text-muted-foreground text-xs font-medium uppercase">
          {m.live_item_notes()}
        </h3>
        {notes === null ? (
          <p className="text-muted-foreground text-xs">{m.live_no_notes()}</p>
        ) : (
          <p className="text-xs whitespace-pre-wrap" data-testid="live-notes">
            {notes}
          </p>
        )}
      </div>
    </section>
  );
}

function StreamPanel({ snapshot, deck }: { snapshot: LiveSnapshot; deck: Deck }) {
  const { session } = snapshot;
  const { streamCursor } = session;
  const run = useRun();
  const streamGoTo = useAtomSet(liveStreamGoToAtom, { mode: "promiseExit" });
  const streamNext = useAtomSet(liveStreamNextAtom, { mode: "promiseExit" });
  const streamPrevious = useAtomSet(liveStreamPreviousAtom, { mode: "promiseExit" });
  const setLinked = useAtomSet(liveStreamSetLinkedAtom, { mode: "promiseExit" });

  const parts =
    streamCursor === null
      ? []
      : (deck.items.find((item) => item.itemId === streamCursor.itemId)?.slides[
          streamCursor.slideIndex
        ]?.parts ?? []);

  return (
    <section className="space-y-2" data-testid="live-stream">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-xs font-medium uppercase">{m.live_stream()}</h2>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={session.streamLinked}
            onChange={(event) => run(setLinked({ payload: { linked: event.target.checked } }))}
          />
          {m.live_stream_linked()}
        </label>
      </div>
      <CoverPreview
        track="stream"
        cover={session.streamCover}
        content={streamFrameContent(deck, streamCursor, session.streamOverride)}
        ringClassName="ring-sky-500"
      />
      <CoverButtons track="stream" cover={session.streamCover} size="sm" />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => run(streamPrevious({ payload: undefined }))}
        >
          <ChevronLeft className="size-4" aria-hidden />
          {m.live_stream_previous()}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => run(streamNext({ payload: undefined }))}
        >
          {m.live_stream_next()}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
      {streamCursor !== null && parts.length > 1 && (
        <ol className="space-y-1" aria-label={m.live_stream_parts()}>
          {parts.map((part, index) => (
            <li key={index}>
              <button
                type="button"
                aria-current={index === streamCursor.part ? "true" : undefined}
                onClick={() =>
                  run(
                    streamGoTo({
                      payload: {
                        itemId: streamCursor.itemId,
                        slideIndex: streamCursor.slideIndex,
                        part: index,
                      },
                    }),
                  )
                }
                className={cn(
                  "hover:bg-muted w-full truncate border px-2 py-1 text-left text-xs",
                  index === streamCursor.part && "border-sky-500 bg-sky-500/10",
                )}
              >
                <span className="text-muted-foreground mr-1.5">
                  {m.live_stream_part({ number: index + 1 })}
                </span>
                {partSummary(part)}
              </button>
            </li>
          ))}
        </ol>
      )}
      {streamCursor !== null && (
        <LinePicker
          key={`${streamCursor.itemId}:${streamCursor.slideIndex}`}
          deck={deck}
          cursor={streamCursor}
          override={session.streamOverride}
        />
      )}
    </section>
  );
}

/** Ajustement manuel : choix libre des lignes de la diapo envoyées au stream. */
function LinePicker({
  deck,
  cursor,
  override,
}: {
  deck: Deck;
  cursor: StreamCursor;
  override: StreamOverride | null;
}) {
  const run = useRun();
  const showLines = useAtomSet(liveStreamShowLinesAtom, { mode: "promiseExit" });
  const resume = useAtomSet(liveStreamResumeAtom, { mode: "promiseExit" });
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());

  const content = deck.items.find((item) => item.itemId === cursor.itemId)?.slides[
    cursor.slideIndex
  ]?.content;
  const lines = content?._tag === "Lines" ? content.lines : [];

  return (
    <div className="space-y-2">
      {override !== null && (
        <div className="flex items-center justify-between gap-2 border border-amber-500/60 bg-amber-500/10 px-2 py-1 text-xs">
          <span>{m.live_stream_manual()}</span>
          <Button size="sm" variant="outline" onClick={() => run(resume({ payload: undefined }))}>
            {m.live_stream_resume()}
          </Button>
        </div>
      )}
      {lines.length > 0 && (
        <details className="border px-2 py-1 text-xs" data-testid="line-picker">
          <summary className="cursor-pointer select-none">{m.live_stream_pick_lines()}</summary>
          <p className="text-muted-foreground my-1">{m.live_stream_lines_hint()}</p>
          <ul className="space-y-1">
            {lines.map((line, index) => (
              <li key={index}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.has(index)}
                    disabled={!selected.has(index) && selected.size >= 12}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(index);
                        else next.delete(index);
                        return next;
                      })
                    }
                  />
                  <span>{line}</span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            className="mt-2 w-full"
            disabled={selected.size === 0}
            onClick={() =>
              run(
                showLines({
                  payload: {
                    lines: [...selected]
                      .sort((a, b) => a - b)
                      .flatMap((index) => lines[index] ?? []),
                    caption: content?._tag === "Lines" ? content.caption : null,
                  },
                }),
              )
            }
          >
            {m.live_stream_send_lines()}
          </Button>
        </details>
      )}
    </div>
  );
}

const coverLabels = {
  black: m.live_cover_black,
  logo: m.live_cover_logo,
  hideText: m.live_cover_hide_text,
} as const;

const activeCoverLabels = {
  black: m.live_cover_active_black,
  logo: m.live_cover_active_logo,
  hideText: m.live_cover_active_hide_text,
} as const;

const coverIcons = { black: MonitorOff, logo: ImageIcon, hideText: EyeOff } as const;

/** Boutons d'urgence d'une piste : un clic active, un second revient au contenu. */
function CoverButtons({
  track,
  cover,
  size = "default",
}: {
  track: Track;
  cover: Cover;
  size?: "default" | "sm";
}) {
  const run = useRun();
  const setCover = useAtomSet(liveSetCoverAtom, { mode: "promiseExit" });

  return (
    <div
      role="group"
      aria-label={track === "room" ? m.live_room() : m.live_stream()}
      className={cn("flex flex-wrap gap-2", size === "sm" && "w-full")}
    >
      {(["black", "logo", "hideText"] as const).map((option) => {
        const Icon = coverIcons[option];
        const active = cover === option;
        return (
          <Button
            key={option}
            size={size}
            variant={active ? "destructive" : "outline"}
            className={cn(size === "sm" && "flex-1")}
            aria-pressed={active}
            onClick={() => run(setCover({ payload: { track, cover: active ? "none" : option } }))}
          >
            <Icon className="size-4" aria-hidden />
            {coverLabels[option]()}
          </Button>
        );
      })}
    </div>
  );
}

/** Aperçu d'une piste tel que le voient ses écrans, bouton d'urgence compris. */
function CoverPreview({
  track,
  cover,
  content,
  ringClassName,
  testId,
}: {
  track: Track;
  cover: Cover;
  content: FrameContent;
  ringClassName: string;
  testId?: string;
}) {
  const { data: organization } = authClient.useActiveOrganization();
  const branding = { name: organization?.name ?? "", logoUrl: organization?.logo ?? null };

  return (
    <div
      className={cn("relative ring-2", cover === "none" ? ringClassName : "ring-red-500")}
      style={track === "stream" ? transparencyBackground : undefined}
      data-testid={testId}
    >
      <FrameView content={content} cover={cover} type={track} branding={branding} />
      {cover !== "none" && (
        <span className="absolute top-2 left-2 bg-red-600 px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
          {activeCoverLabels[cover]()}
        </span>
      )}
    </div>
  );
}

const itemTitle = (item: DeckItem) =>
  item.kind === "Blank" ? m.live_blank_item() : item.title || m.live_missing();

function DeckView({
  deck,
  cursor,
  streamCursor,
  onPick,
  onPickStream,
}: {
  deck: Deck;
  cursor: LiveCursor | null;
  streamCursor: StreamCursor | null;
  onPick: (itemId: ProjectItemId, slideIndex: number) => void;
  onPickStream: (itemId: ProjectItemId, slideIndex: number) => void;
}) {
  const currentSlide = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    currentSlide.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cursor?.itemId, cursor?.slideIndex]);

  return (
    <ol className="space-y-5" data-testid="live-deck">
      {deck.items.map((item, index) => (
        <li key={item.itemId} className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground w-5 text-right text-xs">{index + 1}</span>
            <span className="truncate">{itemTitle(item)}</span>
          </h2>
          {item.missing ? (
            <p className="text-muted-foreground pl-7 text-xs">{m.live_missing()}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 pl-7 sm:grid-cols-3 xl:grid-cols-4">
              {item.slides.map((slide, slideIndex) => {
                const active = cursor?.itemId === item.itemId && cursor.slideIndex === slideIndex;
                const onStream =
                  streamCursor?.itemId === item.itemId && streamCursor.slideIndex === slideIndex;
                const label = slide.label ?? m.live_slide_label({ number: slideIndex + 1 });
                return (
                  <button
                    key={slideIndex}
                    ref={active ? currentSlide : undefined}
                    type="button"
                    aria-current={active ? "true" : undefined}
                    aria-label={`${itemTitle(item)} — ${label}`}
                    onClick={(event) =>
                      event.shiftKey
                        ? onPickStream(item.itemId, slideIndex)
                        : onPick(item.itemId, slideIndex)
                    }
                    className={cn(
                      "relative block w-full text-left ring-1 ring-foreground/10 transition hover:ring-foreground/40 focus-visible:ring-2 focus-visible:outline-none",
                      active && "ring-2 ring-red-500 hover:ring-red-500",
                    )}
                  >
                    <SlideRenderer theme={roomTheme} slide={contentToSlide(slide.content)} />
                    {onStream && (
                      <span
                        className="absolute top-1 right-1 bg-sky-500 px-1 text-[0.6rem] font-medium text-white"
                        data-testid="stream-marker"
                      >
                        {m.live_stream_marker()}
                        {slide.parts.length > 1 &&
                          ` ${streamCursor.part + 1}/${slide.parts.length}`}
                      </span>
                    )}
                    <span className="text-muted-foreground block truncate px-1 py-0.5 text-[0.65rem]">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
