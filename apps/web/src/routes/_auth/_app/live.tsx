import { useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  type Deck,
  type DeckItem,
  type LiveCursor,
  type LiveSnapshot,
  contentAt,
  nextCursor,
} from "@projection/live/domain";
import type { ProjectItemId } from "@projection/shared-kernel";
import { Button } from "@projection/ui/components/button";
import { cn } from "@projection/ui/lib/utils";
import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";
import { Exit } from "effect";
import { ChevronLeft, ChevronRight, MonitorOff, Radio, Square } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { contentToSlide, roomTheme } from "@/features/display/frame";
import {
  liveAtom,
  liveGoToAtom,
  liveNextAtom,
  livePreviousAtom,
  liveRefreshAtom,
  liveSetBlackoutAtom,
  liveStartAtom,
  liveStopAtom,
} from "@/features/live/atoms";
import { SlideRenderer } from "@/features/presentation/slide-renderer";
import { projectAtom, projectsListAtom } from "@/features/projects/atoms";
import { formatProjectDate } from "@/features/projects/format";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/live")({
  component: () => (
    <ClientOnly fallback={<Loader />}>
      <LivePage />
    </ClientOnly>
  ),
});

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

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

function Regie({ snapshot, deck }: { snapshot: LiveSnapshot; deck: Deck }) {
  const { session } = snapshot;
  const run = useRun();
  const goTo = useAtomSet(liveGoToAtom, { mode: "promiseExit" });
  const next = useAtomSet(liveNextAtom, { mode: "promiseExit" });
  const previous = useAtomSet(livePreviousAtom, { mode: "promiseExit" });
  const setBlackout = useAtomSet(liveSetBlackoutAtom, { mode: "promiseExit" });
  const refresh = useAtomSet(liveRefreshAtom, { mode: "promiseExit" });
  const stop = useAtomSet(liveStopAtom, { mode: "promiseExit" });

  const blackout = useRef(session.blackout);
  blackout.current = session.blackout;

  // Projet modifié (élément ajouté, réordonné…) : la régie relit le projet sans perdre sa position.
  const project = useAtomValue(projectAtom(deck.projectId));
  const projectVersion = project._tag === "Success" ? project.value.updatedAt : null;
  useEffect(() => {
    if (projectVersion !== null) void run(refresh({ payload: undefined }));
  }, [projectVersion, refresh, run]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
        void run(next({ payload: undefined }));
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
        void run(previous({ payload: undefined }));
      } else if (event.key === "b" || event.key === "B") {
        void run(setBlackout({ payload: { blackout: !blackout.current } }));
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, setBlackout, run]);

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
          <Button
            variant={session.blackout ? "destructive" : "outline"}
            aria-pressed={session.blackout}
            onClick={() => run(setBlackout({ payload: { blackout: !session.blackout } }))}
          >
            <MonitorOff className="size-4" aria-hidden />
            {m.live_blackout()}
          </Button>
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
          onPick={(itemId, slideIndex) => run(goTo({ payload: { itemId, slideIndex } }))}
        />
      </div>

      <aside className="bg-card space-y-4 border-t p-4 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l xl:w-96">
        <section className="space-y-1">
          <h2 className="text-muted-foreground text-xs font-medium uppercase">{m.live_screen()}</h2>
          <div
            className={cn("relative ring-2", session.blackout ? "ring-red-500" : "ring-green-600")}
            data-testid="live-screen"
          >
            <SlideRenderer
              theme={roomTheme}
              slide={session.blackout ? { kind: "blank" } : contentToSlide(current)}
            />
            {session.blackout && (
              <span className="absolute top-2 left-2 bg-red-600 px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
                {m.live_blackout_active()}
              </span>
            )}
          </div>
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
        <Link to="/outputs" className="text-muted-foreground block text-xs underline">
          {m.live_outputs_link()}
        </Link>
      </aside>
    </div>
  );
}

const itemTitle = (item: DeckItem) =>
  item.kind === "Blank" ? m.live_blank_item() : item.title || m.live_missing();

function DeckView({
  deck,
  cursor,
  onPick,
}: {
  deck: Deck;
  cursor: LiveCursor | null;
  onPick: (itemId: ProjectItemId, slideIndex: number) => void;
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
                const label = slide.label ?? m.live_slide_label({ number: slideIndex + 1 });
                return (
                  <button
                    key={slideIndex}
                    ref={active ? currentSlide : undefined}
                    type="button"
                    aria-current={active ? "true" : undefined}
                    aria-label={`${itemTitle(item)} — ${label}`}
                    onClick={() => onPick(item.itemId, slideIndex)}
                    className={cn(
                      "block w-full text-left ring-1 ring-foreground/10 transition hover:ring-foreground/40 focus-visible:ring-2 focus-visible:outline-none",
                      active && "ring-2 ring-red-500 hover:ring-red-500",
                    )}
                  >
                    <SlideRenderer theme={roomTheme} slide={contentToSlide(slide.content)} />
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
