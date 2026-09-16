import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Project, ProjectItem } from "@projection/projects/domain";
import type { ProjectItemId } from "@projection/shared-kernel";
import { Button } from "@projection/ui/components/button";
import { Textarea } from "@projection/ui/components/textarea";
import { cn } from "@projection/ui/lib/utils";
import { Exit } from "effect";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  GripVertical,
  ImageIcon,
  type LucideIcon,
  Music,
  Presentation,
  Square,
  StickyNote,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { translationsAtom } from "@/features/bible/atoms";
import { mediaListAtom } from "@/features/media/atoms";
import { slidesListAtom } from "@/features/slides/atoms";
import { songsListAtom } from "@/features/songs/atoms";
import { m } from "@/paraglide/messages";

import { moveItemAtom, projectsReactivity, removeItemAtom, setItemNotesAtom } from "./atoms";

/** Titres des éléments, résolus depuis les bibliothèques déjà chargées. */
function useItemLabels() {
  const songs = useAtomValue(songsListAtom(""));
  const slides = useAtomValue(slidesListAtom(""));
  const translations = useAtomValue(translationsAtom);
  const media = useAtomValue(mediaListAtom);

  const songTitles = new Map(
    songs._tag === "Success" ? songs.value.map((song) => [song.id, song.title]) : [],
  );
  const slideTitles = new Map(
    slides._tag === "Success" ? slides.value.map((slide) => [slide.id, slide.title]) : [],
  );
  const mediaNames = new Map(
    media._tag === "Success" ? media.value.map((asset) => [asset.id, asset.name]) : [],
  );
  const translationCodes = new Map(
    translations._tag === "Success"
      ? translations.value.map((translation) => [translation.id, translation.code])
      : [],
  );
  const loading = songs._tag === "Initial" || slides._tag === "Initial";

  return (item: ProjectItem): { icon: LucideIcon; kind: string; label: string } => {
    switch (item._tag) {
      case "Song":
        return {
          icon: Music,
          kind: m.item_kind_song(),
          label: songTitles.get(item.songId) ?? (loading ? "…" : m.item_missing_song()),
        };
      case "Scripture":
        return {
          icon: BookOpen,
          kind: m.item_kind_scripture(),
          label: `${item.reference} (${translationCodes.get(item.translationId) ?? item.translationId})`,
        };
      case "TextSlide":
        return {
          icon: Presentation,
          kind: m.item_kind_slide(),
          label: slideTitles.get(item.textSlideId) ?? (loading ? "…" : m.item_missing_slide()),
        };
      case "Media":
        return {
          icon: ImageIcon,
          kind: m.item_kind_media(),
          label: mediaNames.get(item.mediaId) ?? (loading ? "…" : m.item_missing_media()),
        };
      case "Blank":
        return { icon: Square, kind: m.item_kind_blank(), label: m.item_blank() };
    }
  };
}

export function ProjectItems({ project }: { project: Project }) {
  const labelOf = useItemLabels();
  const move = useAtomSet(moveItemAtom, { mode: "promiseExit" });
  const remove = useAtomSet(removeItemAtom, { mode: "promiseExit" });
  const [dragging, setDragging] = useState<ProjectItemId | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const setNotes = useAtomSet(setItemNotesAtom, { mode: "promiseExit" });
  const [editingNotes, setEditingNotes] = useState<ProjectItemId | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const run = async (action: Promise<Exit.Exit<unknown, unknown>>) => {
    if (Exit.isFailure(await action)) toast.error(m.project_action_error());
  };

  const moveTo = (itemId: ProjectItemId, toIndex: number) =>
    run(
      move({
        payload: { projectId: project.id, itemId, toIndex },
        reactivityKeys: projectsReactivity,
      }),
    );

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium">{m.project_items({ count: project.items.length })}</h2>
        {project.items.length > 1 && (
          <p className="text-muted-foreground text-xs">{m.project_drag_hint()}</p>
        )}
      </div>

      {project.items.length === 0 ? (
        <p className="text-muted-foreground border p-4 text-sm">{m.project_items_empty()}</p>
      ) : (
        <ol className="divide-y border" data-testid="project-items">
          {project.items.map((item, index) => {
            const { icon: Icon, kind, label } = labelOf(item);
            return (
              <li
                key={item.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", item.id);
                  event.dataTransfer.effectAllowed = "move";
                  setDragging(item.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setDropIndex(null);
                }}
                onDragOver={(event) => {
                  if (dragging === null) return;
                  event.preventDefault();
                  setDropIndex(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragging !== null && dragging !== item.id) moveTo(dragging, index);
                  setDragging(null);
                  setDropIndex(null);
                }}
                className={cn(
                  "p-2 text-sm",
                  dragging === item.id && "opacity-50",
                  dropIndex === index && dragging !== item.id && "bg-muted",
                )}
              >
                <div className="flex items-center gap-2">
                  <GripVertical
                    className="text-muted-foreground size-4 shrink-0 cursor-grab"
                    aria-hidden
                  />
                  <span className="text-muted-foreground w-6 shrink-0 text-right text-xs">
                    {index + 1}
                  </span>
                  <Icon className="text-muted-foreground size-4 shrink-0" aria-label={kind} />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`${m.project_move_up()} : ${label}`}
                    disabled={index === 0}
                    onClick={() => moveTo(item.id, index - 1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`${m.project_move_down()} : ${label}`}
                    disabled={index === project.items.length - 1}
                    onClick={() => moveTo(item.id, index + 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`${m.project_remove_item()} : ${label}`}
                    onClick={() =>
                      run(
                        remove({
                          payload: { projectId: project.id, itemId: item.id },
                          reactivityKeys: projectsReactivity,
                        }),
                      )
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`${m.project_item_notes()} : ${label}`}
                    aria-pressed={editingNotes === item.id}
                    onClick={() => {
                      setNotesDraft(item.notes ?? "");
                      setEditingNotes((current) => (current === item.id ? null : item.id));
                    }}
                  >
                    <StickyNote
                      className={cn("size-3.5", item.notes !== undefined && "text-amber-500")}
                    />
                  </Button>
                </div>
                {editingNotes === item.id ? (
                  <div className="mt-2 space-y-2 pl-8">
                    <Textarea
                      aria-label={`${m.project_item_notes()} : ${label}`}
                      className="min-h-20 text-sm"
                      maxLength={2000}
                      placeholder={m.project_item_notes_placeholder()}
                      value={notesDraft}
                      onChange={(event) => setNotesDraft(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          const exit = await setNotes({
                            payload: {
                              projectId: project.id,
                              itemId: item.id,
                              notes: notesDraft.trim() === "" ? null : notesDraft,
                            },
                            reactivityKeys: projectsReactivity,
                          });
                          if (Exit.isSuccess(exit)) {
                            toast.success(m.project_item_notes_saved());
                            setEditingNotes(null);
                          } else {
                            toast.error(m.project_action_error());
                          }
                        }}
                      >
                        {m.project_item_notes_save()}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>
                        {m.project_item_notes_cancel()}
                      </Button>
                    </div>
                  </div>
                ) : (
                  item.notes !== undefined && (
                    <p className="text-muted-foreground mt-1 pl-8 text-xs whitespace-pre-wrap">
                      {item.notes}
                    </p>
                  )
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
