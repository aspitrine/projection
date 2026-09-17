import { useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  formatReference,
  type Passage,
  type ScriptureReference,
  type Verse,
} from "@projection/bible/domain";
import {
  type Deck,
  type DeckItem,
  type LiveSession,
  type LiveSnapshot,
  type StreamCursor,
  type StreamOverride,
  contentAt,
  nextCursor,
  streamFrameContent,
  withPlayback,
} from "@projection/live/domain";
import { LiveCursor } from "@projection/live/domain";
import {
  type Cover,
  type FrameContent,
  remainingMs,
  type Track,
  videoEnded,
  type VideoPlayback,
  videoPositionMs,
} from "@projection/presentation/domain";
import type { ProjectId, ProjectItemId, SongId } from "@projection/shared-kernel";
import type { ProjectItem } from "@projection/projects/domain";
import { formatTag } from "@projection/songs/domain";
import { Button } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Textarea } from "@projection/ui/components/textarea";
import { cn } from "@projection/ui/lib/utils";
import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { Exit } from "effect";
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  GripVertical,
  ImageIcon,
  MonitorOff,
  MonitorPlay,
  Radio,
  Pause,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Play,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import {
  PendingBanner,
  PendingCommands,
  useRun,
  usePendingCommands,
} from "@/features/live/commands";
import { contentToSlide, roomTheme } from "@/features/display/frame";
import { FrameView } from "@/features/display/frame-view";
import { OutputsDialog } from "@/features/outputs/outputs-dialog";
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
  liveVideoDurationAtom,
  liveVideoPauseAtom,
  liveVideoPlayAtom,
  liveVideoRestartAtom,
  liveVideoSeekAtom,
} from "@/features/live/atoms";
import { SlideRenderer } from "@/features/presentation/slide-renderer";
import { projectAtom, projectsListAtom } from "@/features/projects/atoms";
import { AddItemPanel } from "@/features/projects/add-item-panel";
import { passageBoundsAtom, passageKey } from "@/features/bible/atoms";
import { EditItemDialog } from "@/features/live/edit-item-dialog";
import { LiveSlideCards } from "@/features/live/slide-cards";
import {
  moveItemAtom,
  projectsReactivity,
  removeItemAtom,
  replaceItemAtom,
} from "@/features/projects/atoms";
import { songAtom } from "@/features/songs/atoms";
import { formatProjectDate } from "@/features/projects/format";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/live")({
  component: () => <Navigate to="/projects" />,
});

/** Damier derrière l'aperçu stream : rend la transparence visible. */
const transparencyBackground = {
  backgroundImage: "repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%)",
  backgroundSize: "16px 16px",
} as const;

const partSummary = (content: FrameContent) =>
  content._tag === "Lines" ? content.lines.join(" / ") : content._tag === "Rich" ? "…" : "—";

/** Régie embarquée dans la page d'un projet. L'ouverture d'un projet le rend actif. */
export function ProjectRegie({
  projectId,
  headerActions,
}: {
  projectId: ProjectId;
  headerActions?: ReactNode;
}) {
  const commands = usePendingCommands();

  return (
    <PendingCommands.Provider value={commands}>
      <PendingBanner pending={commands.pending} />
      <ProjectRegieContent projectId={projectId} headerActions={headerActions} />
    </PendingCommands.Provider>
  );
}

function ProjectRegieContent({
  projectId,
  headerActions,
}: {
  projectId: ProjectId;
  headerActions?: ReactNode;
}) {
  const result = useAtomValue(liveAtom);
  const start = useAtomSet(liveStartAtom, { mode: "promiseExit" });
  const run = useRun();
  const activeProjectId = result._tag === "Success" ? result.value.session.projectId : null;

  // On attend la session courante : relancer le projet déjà ouvert ramènerait au premier élément.
  const loaded = result._tag === "Success";
  useEffect(() => {
    if (!loaded || activeProjectId === projectId) return;
    void run(() => start({ payload: { projectId } }));
  }, [loaded, activeProjectId, projectId, run, start]);

  if (result._tag === "Initial") return <Loader />;
  if (result._tag === "Failure") {
    return <p className="p-6 text-sm text-red-500">{m.live_load_error()}</p>;
  }
  const snapshot = result.value;
  return snapshot.deck === null || snapshot.session.projectId !== projectId ? (
    <Loader />
  ) : (
    <Regie snapshot={snapshot} deck={snapshot.deck} headerActions={headerActions} />
  );
}

export function ProjectPicker() {
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
              <Button
                size="sm"
                onClick={() => run(() => start({ payload: { projectId: project.id } }))}
              >
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

function Regie({
  snapshot,
  deck,
  headerActions,
}: {
  snapshot: LiveSnapshot;
  deck: Deck;
  headerActions?: ReactNode;
}) {
  const { session } = snapshot;
  const [outputsOpen, setOutputsOpen] = useState(false);
  const run = useRun();
  const goTo = useAtomSet(liveGoToAtom, { mode: "promiseExit" });
  const next = useAtomSet(liveNextAtom, { mode: "promiseExit" });
  const previous = useAtomSet(livePreviousAtom, { mode: "promiseExit" });
  const setCover = useAtomSet(liveSetCoverAtom, { mode: "promiseExit" });
  const refresh = useAtomSet(liveRefreshAtom, { mode: "promiseExit" });
  const stop = useAtomSet(liveStopAtom, { mode: "promiseExit" });
  const streamNext = useAtomSet(liveStreamNextAtom, { mode: "promiseExit" });
  const streamPrevious = useAtomSet(liveStreamPreviousAtom, { mode: "promiseExit" });
  const [selected, setSelected] = useState<LiveCursor | null>(session.cursor);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Les commandes « précédente/suivante » font évoluer la session. La sélection
  // centrale doit suivre ce curseur, sinon elle reste sur la diapo choisie au chargement.
  useEffect(() => {
    setSelected(session.cursor);
  }, [session.cursor?.itemId, session.cursor?.slideIndex]);

  const covers = useRef({ room: session.roomCover, stream: session.streamCover });
  covers.current = { room: session.roomCover, stream: session.streamCover };

  // Projet modifié (élément ajouté, réordonné…) : la régie relit le projet sans perdre sa position.
  const project = useAtomValue(projectAtom(deck.projectId));
  const projectVersion = project._tag === "Success" ? project.value.updatedAt : null;
  useEffect(() => {
    if (projectVersion !== null) void run(() => refresh({ payload: undefined }));
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
        void run(() => streamNext({ payload: undefined }));
      } else if (event.shiftKey && backward) {
        void run(() => streamPrevious({ payload: undefined }));
      } else if (forward) {
        void run(() => next({ payload: undefined }));
      } else if (backward) {
        void run(() => previous({ payload: undefined }));
      } else if (event.key === "b" || event.key === "B") {
        const track: Track = event.shiftKey ? "stream" : "room";
        const cover: Cover = covers.current[track] === "hideText" ? "none" : "hideText";
        void run(() => setCover({ payload: { track, cover } }), `cover:${track}`);
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

  // Les aperçus suivent la lecture vidéo, comme les écrans.
  const current = withPlayback(contentAt(deck, session.cursor), snapshot.video);
  const selectedItem =
    selected === null ? null : (deck.items.find((item) => item.itemId === selected.itemId) ?? null);
  const selectedProjectItem =
    selected === null || project._tag !== "Success"
      ? null
      : (project.value.items.find((item) => item.id === selected.itemId) ?? null);
  const upcomingCursor = session.cursor === null ? null : nextCursor(deck, session.cursor);
  const hasUpcoming =
    upcomingCursor !== null &&
    (upcomingCursor.itemId !== session.cursor?.itemId ||
      upcomingCursor.slideIndex !== session.cursor.slideIndex);

  return (
    // Sous `lg`, les aperçus et les panneaux passent devant le déroulé et la barre
    // de pilotage reste fixée en bas de l'écran (tablette, téléphone).
    <div className="flex min-h-full flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:min-h-0 lg:flex-1 lg:pb-0">
      <header className="bg-background sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b p-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs uppercase">{m.nav_live()}</p>
          <div className="flex min-w-0 items-center gap-1">
            <h1 className="truncate text-xl font-semibold">{deck.projectName}</h1>
            {headerActions && (
              <div className="flex shrink-0 items-center gap-1">{headerActions}</div>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          className="hidden lg:inline-flex"
          onClick={() => run(() => previous({ payload: undefined }))}
        >
          <ChevronLeft className="size-4" aria-hidden />
          {m.live_previous()}
        </Button>
        <Button
          className="hidden lg:inline-flex"
          onClick={() => run(() => next({ payload: undefined }))}
        >
          {m.live_next()}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <div className="hidden lg:block">
          <CoverButtons track="room" cover={session.roomCover} />
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm(m.live_stop_confirm())) void run(() => stop({ payload: undefined }));
          }}
        >
          <Square className="size-4" aria-hidden />
          {m.live_stop()}
        </Button>
        <Button variant="outline" onClick={() => setOutputsOpen(true)}>
          <MonitorPlay className="size-4" aria-hidden />
          {m.outputs_title()}
        </Button>
        <OutputsDialog
          projectId={deck.projectId}
          open={outputsOpen}
          onOpenChange={setOutputsOpen}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="bg-card order-first border-b lg:order-none lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div className="border-b p-3">
            <AddItemPanel projectId={deck.projectId} />
          </div>
          <RunSheet
            deck={deck}
            selected={selected}
            live={session.cursor}
            onSelect={(itemId, slideIndex) => setSelected(new LiveCursor({ itemId, slideIndex }))}
          />
        </aside>

        <main className="min-w-0 flex-1 space-y-4 p-4 lg:overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-muted-foreground text-xs uppercase">Diffusion</p>
              <h2 className="font-medium">
                {selectedItem === null ? "Aucun élément sélectionné" : itemTitle(selectedItem)}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {selectedProjectItem !== null &&
                (selectedProjectItem._tag === "Song" ||
                  selectedProjectItem._tag === "TextSlide" ||
                  selectedProjectItem._tag === "Scripture" ||
                  selectedProjectItem._tag === "Media") && (
                  <EditItemDialog projectId={deck.projectId} item={selectedProjectItem} />
                )}
              {selectedItem !== null && (
                <RemoveItemButton
                  projectId={deck.projectId}
                  itemId={selectedItem.itemId}
                  title={itemTitle(selectedItem)}
                  onRemoved={() => setSelected(null)}
                />
              )}
            </div>
          </div>
          {selected === null ? (
            <p className="text-muted-foreground border border-dashed p-8 text-center text-sm">
              Sélectionnez un élément dans l’ordre de passage.
            </p>
          ) : selectedItem === null ? null : (
            <SelectedSlides
              item={selectedItem}
              live={session.cursor}
              projectId={deck.projectId}
              projectItem={selectedProjectItem}
              onBroadcast={(slideIndex) => {
                const cursor = new LiveCursor({ itemId: selectedItem.itemId, slideIndex });
                setSelected(cursor);
                void run(() => goTo({ payload: cursor }), "cursor");
              }}
            />
          )}
          <p className="text-muted-foreground text-xs">{m.live_shortcuts()}</p>
        </main>

        <aside
          className={cn(
            "bg-card relative space-y-4 border-t p-4 lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l",
            !rightPanelOpen && "hidden lg:block lg:w-12 lg:p-2",
          )}
        >
          <Button
            size="icon-sm"
            variant="ghost"
            className="absolute top-2 right-2"
            aria-label={
              rightPanelOpen ? "Masquer le panneau de régie" : "Afficher le panneau de régie"
            }
            aria-pressed={rightPanelOpen}
            onClick={() => setRightPanelOpen((open) => !open)}
          >
            {rightPanelOpen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
          </Button>
          {rightPanelOpen && (
            <>
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
              {current._tag === "Video" && (
                <VideoPanel playback={snapshot.video} url={current.url} />
              )}
              <StagePanel session={session} deck={deck} />
              <StreamPanel snapshot={snapshot} deck={deck} />
            </>
          )}
        </aside>
      </div>

      <LiveBar cover={session.roomCover} />
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
function VideoPanel({ playback, url }: { playback: VideoPlayback; url: string }) {
  const run = useRun();
  // Rafraîchi plus souvent que l'horloge : la barre doit avancer sans à-coups.
  const now = useNow(250);
  const play = useAtomSet(liveVideoPlayAtom, { mode: "promiseExit" });
  const pause = useAtomSet(liveVideoPauseAtom, { mode: "promiseExit" });
  const restart = useAtomSet(liveVideoRestartAtom, { mode: "promiseExit" });
  const seek = useAtomSet(liveVideoSeekAtom, { mode: "promiseExit" });
  const setDuration = useAtomSet(liveVideoDurationAtom, { mode: "promiseExit" });
  const [scrubbing, setScrubbing] = useState<number | null>(null);

  const position = videoPositionMs(playback, now);
  const ended = videoEnded(playback, now);
  const known = playback.durationMs > 0;

  // Arrivée en fin de fichier : la régie arrête la lecture, les écrans suivent.
  useEffect(() => {
    if (playback.playing && ended) void run(() => pause({ payload: undefined }));
  }, [playback.playing, ended, pause, run]);

  const commitSeek = () => {
    if (scrubbing === null) return;
    void run(() => seek({ payload: { positionMs: Math.round(scrubbing) } }), "video");
    setScrubbing(null);
  };

  return (
    <section className="space-y-2" data-testid="live-video">
      {/* Mesure la durée du fichier : le serveur ne la connaît pas. */}
      <video
        src={url}
        preload="metadata"
        muted
        className="hidden"
        onLoadedMetadata={(event) => {
          const durationMs = Math.round(event.currentTarget.duration * 1000);
          if (!Number.isFinite(durationMs) || durationMs <= 0) return;
          if (Math.abs(durationMs - playback.durationMs) < 500) return;
          void run(() => setDuration({ payload: { durationMs } }));
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-xs font-medium uppercase">{m.live_video()}</h2>
        <span className="text-xs tabular-nums" data-testid="live-video-position">
          {formatDuration(scrubbing ?? position)}
          {known && ` / ${formatDuration(playback.durationMs)}`}
        </span>
      </div>

      <input
        type="range"
        className="w-full"
        aria-label={m.live_video_progress()}
        min={0}
        max={known ? playback.durationMs : 1}
        step={100}
        disabled={!known}
        value={scrubbing ?? Math.min(position, playback.durationMs || 1)}
        onChange={(event) => setScrubbing(event.target.valueAsNumber)}
        onPointerUp={commitSeek}
        onKeyUp={commitSeek}
        onBlur={commitSeek}
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() =>
            run(
              () =>
                playback.playing ? pause({ payload: undefined }) : play({ payload: undefined }),
              "video",
            )
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
          onClick={() => run(() => restart({ payload: undefined }), "video")}
          aria-label={m.live_video_stop()}
          title={m.live_video_stop()}
        >
          <Square className="size-4" aria-hidden />
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
            run(
              () =>
                running ? pauseTimer({ payload: undefined }) : startTimer({ payload: undefined }),
              "timer",
            )
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
          onClick={() => run(() => resetTimer({ payload: undefined }), "timer")}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () => setTimer({ payload: { durationMs: Math.round(minutes * 60_000) } }),
            "timer",
          );
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
            onChange={(event) =>
              run(() => setLinked({ payload: { linked: event.target.checked } }), "streamLinked")
            }
          />
          {m.live_stream_linked()}
        </label>
      </div>
      <CoverPreview
        track="stream"
        cover={session.streamCover}
        content={withPlayback(
          streamFrameContent(deck, streamCursor, session.streamOverride),
          snapshot.video,
        )}
        ringClassName="ring-sky-500"
      />
      <CoverButtons track="stream" cover={session.streamCover} size="sm" />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => run(() => streamPrevious({ payload: undefined }))}
        >
          <ChevronLeft className="size-4" aria-hidden />
          {m.live_stream_previous()}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => run(() => streamNext({ payload: undefined }))}
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
                  run(() =>
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => run(() => resume({ payload: undefined }), "streamOverride")}
          >
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
                () =>
                  showLines({
                    payload: {
                      lines: [...selected]
                        .sort((a, b) => a - b)
                        .flatMap((index) => lines[index] ?? []),
                      caption: content?._tag === "Lines" ? content.caption : null,
                    },
                  }),
                "streamOverride",
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

/** Barre de pilotage fixée en bas sous `lg` : avancer, reculer, masquer le texte. */
function LiveBar({ cover }: { cover: Cover }) {
  const run = useRun();
  const next = useAtomSet(liveNextAtom, { mode: "promiseExit" });
  const previous = useAtomSet(livePreviousAtom, { mode: "promiseExit" });
  const setCover = useAtomSet(liveSetCoverAtom, { mode: "promiseExit" });
  const hidden = cover === "hideText";

  return (
    // La barre longe le contenu : sous `md` plein écran, au-delà elle démarre après la navigation.
    <div
      className="bg-card fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:left-60 lg:hidden"
      data-testid="live-bar"
    >
      <Button
        variant="outline"
        className="h-12 flex-1"
        onClick={() => run(() => previous({ payload: undefined }))}
      >
        <ChevronLeft className="size-5" aria-hidden />
        {m.live_previous()}
      </Button>
      <Button
        variant={hidden ? "destructive" : "outline"}
        size="icon"
        className="size-12"
        aria-pressed={hidden}
        aria-label={m.live_cover_hide_text()}
        onClick={() =>
          run(
            () => setCover({ payload: { track: "room", cover: hidden ? "none" : "hideText" } }),
            "cover:room",
          )
        }
      >
        <EyeOff className="size-5" aria-hidden />
      </Button>
      <Button className="h-12 flex-1" onClick={() => run(() => next({ payload: undefined }))}>
        {m.live_next()}
        <ChevronRight className="size-5" aria-hidden />
      </Button>
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
      {(["logo", "hideText"] as const).map((option) => {
        const Icon = coverIcons[option];
        const active = cover === option;
        return (
          <Button
            key={option}
            size={size}
            variant={active ? "destructive" : "outline"}
            className={cn(size === "sm" && "flex-1")}
            aria-pressed={active}
            onClick={() =>
              run(
                () => setCover({ payload: { track, cover: active ? "none" : option } }),
                `cover:${track}`,
              )
            }
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

/** Ordre de passage compact : la sélection prépare le contenu au centre sans le diffuser. */
/** Retire l'élément sélectionné du projet ; la régie reçoit le déroulé mis à jour. */
function RemoveItemButton({
  projectId,
  itemId,
  title,
  onRemoved,
}: {
  projectId: ProjectId;
  itemId: ProjectItemId;
  title: string;
  onRemoved: () => void;
}) {
  const remove = useAtomSet(removeItemAtom, { mode: "promiseExit" });
  const [pending, setPending] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm(m.live_remove_item_confirm({ title }))) return;
        setPending(true);
        const exit = await remove({
          payload: { projectId, itemId },
          reactivityKeys: projectsReactivity,
        });
        setPending(false);
        if (Exit.isFailure(exit)) return toast.error(m.project_action_error());
        toast.success(m.live_item_removed());
        onRemoved();
      }}
    >
      <Trash2 className="size-4" aria-hidden />
      {m.project_remove_item()}
    </Button>
  );
}

function RunSheet({
  deck,
  selected,
  live,
  onSelect,
}: {
  deck: Deck;
  selected: LiveCursor | null;
  live: LiveCursor | null;
  onSelect: (itemId: ProjectItemId, slideIndex: number) => void;
}) {
  const move = useAtomSet(moveItemAtom, { mode: "promiseExit" });
  const [dragging, setDragging] = useState<ProjectItemId | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const moveTo = async (itemId: ProjectItemId, toIndex: number) => {
    if (toIndex < 0 || toIndex >= deck.items.length) return;
    const exit = await move({
      payload: { projectId: deck.projectId, itemId, toIndex },
      reactivityKeys: projectsReactivity,
    });
    if (Exit.isFailure(exit)) toast.error(m.project_action_error());
  };

  const endDrag = () => {
    setDragging(null);
    setDropIndex(null);
  };

  return (
    <section className="space-y-2 p-3" aria-label="Ordre de passage">
      <h2 className="text-muted-foreground text-xs font-medium uppercase">Ordre de passage</h2>
      <ol className="space-y-1" data-testid="live-deck">
        {deck.items.map((item, index) => {
          const selectedItem = selected?.itemId === item.itemId;
          const liveItem = live?.itemId === item.itemId;
          const title = itemTitle(item);
          return (
            <li
              key={item.itemId}
              className={cn(
                "flex items-center gap-1 rounded",
                dragging === item.itemId && "opacity-50",
                dropIndex === index && dragging !== item.itemId && "ring-1 ring-foreground/40",
              )}
              onDragOver={(event) => {
                if (dragging === null) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging !== null && dragging !== item.itemId) void moveTo(dragging, index);
                endDrag();
              }}
            >
              {/* Poignée : glisser-déposer à la souris, flèches haut/bas au clavier. */}
              <button
                type="button"
                draggable
                aria-label={`${m.project_drag_hint()} : ${title}`}
                title={m.project_drag_hint()}
                className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab touch-none p-1 active:cursor-grabbing"
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", item.itemId);
                  event.dataTransfer.effectAllowed = "move";
                  const row = event.currentTarget.parentElement;
                  if (row !== null) event.dataTransfer.setDragImage(row, 12, 16);
                  setDragging(item.itemId);
                }}
                onDragEnd={endDrag}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                  event.preventDefault();
                  void moveTo(item.itemId, index + (event.key === "ArrowUp" ? -1 : 1));
                }}
              >
                <GripVertical className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                disabled={item.missing || item.slides.length === 0}
                aria-current={selectedItem ? "true" : undefined}
                onClick={() => onSelect(item.itemId, 0)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-2 text-left text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                  selectedItem && "bg-muted font-medium ring-1 ring-foreground/20",
                )}
              >
                <span className="text-muted-foreground w-5 shrink-0 text-right text-xs">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{title}</span>
                {liveItem && (
                  <span
                    className="size-2 shrink-0 rounded-full bg-red-500"
                    aria-label="À l’antenne"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Parties préparées au centre : un clic choisit et diffuse précisément cette diapo. */
function SelectedSlides({
  item,
  live,
  projectId,
  projectItem,
  onBroadcast,
}: {
  item: DeckItem;
  live: LiveCursor | null;
  projectId: ProjectId;
  projectItem: ProjectItem | null;
  onBroadcast: (slideIndex: number) => void;
}) {
  if (projectItem?._tag === "Scripture") {
    return (
      <ScriptureSelectedSlides
        item={item}
        live={live}
        projectId={projectId}
        projectItem={projectItem}
        onBroadcast={onBroadcast}
      />
    );
  }

  return (
    <LiveSlideCards item={item} title={itemTitle(item)} live={live} onBroadcast={onBroadcast} />
  );
}

const extendReference = (passage: Passage, verse: Verse, edge: "before" | "after") => {
  const first = passage.verses[0];
  const last = passage.verses[passage.verses.length - 1];
  if (first === undefined || last === undefined) return passage.label;
  return formatReference({
    book: passage.reference.book,
    start: {
      chapter: edge === "before" ? verse.chapter : first.chapter,
      verse: edge === "before" ? verse.verse : first.verse,
    },
    end: {
      chapter: edge === "after" ? verse.chapter : last.chapter,
      verse: edge === "after" ? verse.verse : last.verse,
    },
  } as ScriptureReference);
};

function ScriptureSelectedSlides({
  item,
  live,
  projectId,
  projectItem,
  onBroadcast,
}: {
  item: DeckItem;
  live: LiveCursor | null;
  projectId: ProjectId;
  projectItem: Extract<ProjectItem, { _tag: "Scripture" }>;
  onBroadcast: (slideIndex: number) => void;
}) {
  const bounds = useAtomValue(
    passageBoundsAtom(passageKey(projectItem.translationId, projectItem.reference)),
  );
  const replace = useAtomSet(replaceItemAtom, { mode: "promiseExit" });
  const [pending, setPending] = useState(false);

  const extend = async (verse: Verse, edge: "before" | "after") => {
    if (bounds._tag !== "Success") return;
    setPending(true);
    const reference = extendReference(bounds.value.passage, verse, edge);
    const exit = await replace({
      payload: {
        projectId,
        itemId: projectItem.id,
        item: { _tag: "Scripture", translationId: projectItem.translationId, reference },
      },
      reactivityKeys: projectsReactivity,
    });
    setPending(false);
    if (Exit.isFailure(exit)) toast.error(m.live_edit_item_failed());
  };

  const extensionCard = (verse: Verse, edge: "before" | "after") => (
    <li>
      <Button
        type="button"
        variant="outline"
        className="h-full min-h-32 w-full flex-col whitespace-normal"
        disabled={pending}
        onClick={() => void extend(verse, edge)}
      >
        {edge === "before" ? (
          <ChevronLeft className="size-5" aria-hidden />
        ) : (
          <ChevronRight className="size-5" aria-hidden />
        )}
        <span>
          {edge === "before" ? m.live_scripture_extend_before() : m.live_scripture_extend_after()}
        </span>
        <span className="text-muted-foreground text-xs">
          {formatReference({
            book: verse.book,
            start: { chapter: verse.chapter, verse: verse.verse },
            end: { chapter: verse.chapter, verse: verse.verse },
          } as ScriptureReference)}
        </span>
      </Button>
    </li>
  );

  return (
    <LiveSlideCards
      item={item}
      title={itemTitle(item)}
      live={live}
      onBroadcast={onBroadcast}
      before={
        bounds._tag === "Success" && bounds.value.previous !== null
          ? extensionCard(bounds.value.previous, "before")
          : undefined
      }
      after={
        bounds._tag === "Success" && bounds.value.next !== null
          ? extensionCard(bounds.value.next, "after")
          : undefined
      }
    />
  );
}

export function DeckView({
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
