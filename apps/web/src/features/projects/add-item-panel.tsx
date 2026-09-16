import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ProjectItemDraft } from "@projection/projects/domain";
import type { MediaId, ProjectId } from "@projection/shared-kernel";
import { Button } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { cn } from "@projection/ui/lib/utils";
import { Exit } from "effect";
import { Plus } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { passageAtom, passageKey, translationsAtom } from "@/features/bible/atoms";
import { mediaListAtom } from "@/features/media/atoms";
import { slidesListAtom } from "@/features/slides/atoms";
import { songsListAtom } from "@/features/songs/atoms";
import { m } from "@/paraglide/messages";

import { addItemAtom, projectsReactivity } from "./atoms";

type Tab = "songs" | "scripture" | "slides" | "media" | "blank";

export function AddItemPanel({ projectId }: { projectId: ProjectId }) {
  const [tab, setTab] = useState<Tab>("songs");
  const add = useAtomSet(addItemAtom, { mode: "promiseExit" });

  const addItem = async (item: ProjectItemDraft) => {
    const exit = await add({
      payload: { projectId, item, position: null },
      reactivityKeys: projectsReactivity,
    });
    if (Exit.isSuccess(exit)) {
      toast.success(m.project_item_added());
    } else {
      toast.error(m.project_action_error());
    }
  };

  const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: "songs", label: m.project_tab_songs() },
    { id: "scripture", label: m.project_tab_scripture() },
    { id: "slides", label: m.project_tab_slides() },
    { id: "media", label: m.project_tab_media() },
    { id: "blank", label: m.project_tab_blank() },
  ];

  return (
    <section className="space-y-3 border p-4" aria-labelledby="add-item-title">
      <h2 id="add-item-title" className="font-medium">
        {m.project_add_title()}
      </h2>
      <div role="tablist" className="flex flex-wrap gap-1">
        {tabs.map(({ id, label }) => (
          <Button
            key={id}
            role="tab"
            aria-selected={tab === id}
            size="sm"
            variant={tab === id ? "default" : "outline"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "songs" && <SongPicker onAdd={addItem} />}
        {tab === "scripture" && <ScripturePicker onAdd={addItem} />}
        {tab === "slides" && <SlidePicker onAdd={addItem} />}
        {tab === "media" && <MediaPicker onAdd={addItem} />}
        {tab === "blank" && (
          <Button onClick={() => addItem({ _tag: "Blank" })}>
            <Plus className="size-4" aria-hidden />
            {m.project_add_blank()}
          </Button>
        )}
      </div>
    </section>
  );
}

type OnAdd = (item: ProjectItemDraft) => void;

function PickerList({
  items,
  onPick,
}: {
  items: ReadonlyArray<{ id: string; title: string }> | null;
  onPick: (id: string) => void;
}) {
  if (items === null) return <p className="text-muted-foreground text-sm">…</p>;
  if (items.length === 0)
    return <p className="text-muted-foreground text-sm">{m.project_no_results()}</p>;
  return (
    <ul className="max-h-72 divide-y overflow-y-auto border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2 p-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          <Button
            size="xs"
            variant="outline"
            aria-label={`${m.project_add()} : ${item.title}`}
            onClick={() => onPick(item.id)}
          >
            <Plus className="size-3.5" aria-hidden />
            {m.project_add()}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function SearchInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      id={id}
      type="search"
      aria-label={m.songs_search_label()}
      placeholder={m.project_search_placeholder()}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function SongPicker({ onAdd }: { onAdd: OnAdd }) {
  const [search, setSearch] = useState("");
  const result = useAtomValue(songsListAtom(useDeferredValue(search)));
  return (
    <div className="space-y-2">
      <SearchInput id="pick-song" value={search} onChange={setSearch} />
      <PickerList
        items={result._tag === "Success" ? result.value : null}
        onPick={(id) => onAdd({ _tag: "Song", songId: id as never })}
      />
    </div>
  );
}

function SlidePicker({ onAdd }: { onAdd: OnAdd }) {
  const [search, setSearch] = useState("");
  const result = useAtomValue(slidesListAtom(useDeferredValue(search)));
  return (
    <div className="space-y-2">
      <SearchInput id="pick-slide" value={search} onChange={setSearch} />
      <PickerList
        items={result._tag === "Success" ? result.value : null}
        onPick={(id) => onAdd({ _tag: "TextSlide", textSlideId: id as never })}
      />
    </div>
  );
}

function ScripturePicker({ onAdd }: { onAdd: OnAdd }) {
  const translations = useAtomValue(translationsAtom);
  const [translationId, setTranslationId] = useState<string>();
  const [reference, setReference] = useState("");
  const deferredReference = useDeferredValue(reference);

  if (translations._tag !== "Success") return <p className="text-muted-foreground text-sm">…</p>;
  if (translations.value.length === 0) {
    return <p className="text-muted-foreground text-sm">{m.bible_no_translation()}</p>;
  }
  const selected = translationId ?? translations.value[0]?.id ?? "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="pick-translation">{m.bible_translation()}</Label>
          <select
            id="pick-translation"
            className="border-input bg-background h-8 rounded-none border px-2 text-xs"
            value={selected}
            onChange={(event) => setTranslationId(event.target.value)}
          >
            {translations.value.map((translation) => (
              <option key={translation.id} value={translation.id}>
                {translation.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="pick-reference">{m.bible_reference()}</Label>
          <Input
            id="pick-reference"
            autoComplete="off"
            placeholder={m.bible_reference_placeholder()}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
      </div>
      {deferredReference.trim() !== "" && (
        <PassageToAdd
          lookupKey={passageKey(selected, deferredReference)}
          onAdd={(label) => onAdd({ _tag: "Scripture", translationId: selected, reference: label })}
        />
      )}
    </div>
  );
}

function PassageToAdd({ lookupKey, onAdd }: { lookupKey: string; onAdd: (label: string) => void }) {
  const result = useAtomValue(passageAtom(lookupKey));
  if (result._tag === "Initial") return <p className="text-muted-foreground text-sm">…</p>;
  if (result._tag === "Failure") {
    return <p className="text-sm text-red-500">{m.bible_error_malformed()}</p>;
  }
  const passage = result.value;
  return (
    <div className={cn("flex items-center gap-2 border p-2 text-sm")}>
      <span className="min-w-0 flex-1 truncate">
        {passage.label} · {m.bible_verses({ count: passage.verses.length })}
      </span>
      <Button size="xs" onClick={() => onAdd(passage.label)}>
        <Plus className="size-3.5" aria-hidden />
        {m.project_add()}
      </Button>
    </div>
  );
}

function MediaPicker({ onAdd }: { onAdd: OnAdd }) {
  const media = useAtomValue(mediaListAtom);

  return (
    <PickerList
      items={
        media._tag === "Success"
          ? media.value.map((asset) => ({ id: asset.id, title: asset.name }))
          : null
      }
      onPick={(mediaId) => onAdd({ _tag: "Media", mediaId: mediaId as MediaId })}
    />
  );
}
