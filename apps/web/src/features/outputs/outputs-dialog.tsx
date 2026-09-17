import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Output, OutputType, SplittingSettings } from "@projection/outputs/domain";
import type { Splitting } from "@projection/presentation/domain";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import type { ProjectId } from "@projection/shared-kernel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@projection/ui/components/dialog";
import { Cause, Exit, Option } from "effect";
import {
  Copy,
  ExternalLink,
  MonitorPlay,
  MonitorSpeaker,
  Pencil,
  RefreshCw,
  ScanEye,
  Trash2,
  Video,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { ThemeEditor } from "@/features/outputs/theme-editor";
import { liveRefreshAtom } from "@/features/live/atoms";
import {
  createOutputAtom,
  identifyOutputAtom,
  outputsListAtom,
  outputsReactivity,
  regenerateTokenAtom,
  removeOutputAtom,
  renameOutputAtom,
  splittingAtom,
  splittingReactivity,
  updateSplittingAtom,
} from "@/features/outputs/atoms";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

/** Liens et réglages des écrans d'un projet. */
export function OutputsDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: ProjectId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{m.outputs_title()}</DialogTitle>
          <DialogDescription>{m.outputs_intro()}</DialogDescription>
        </DialogHeader>
        {open && <OutputsPanel projectId={projectId} />}
      </DialogContent>
    </Dialog>
  );
}

const displayUrl = (output: Output) =>
  new URL(`/display/${output.token}`, window.location.origin).href;

const outputTypes: ReadonlyArray<OutputType> = ["room", "stage", "stream"];

const typeLabels = {
  room: m.output_type_room,
  stage: m.output_type_stage,
  stream: m.output_type_stream,
} as const;

const typeHints = {
  room: m.output_type_hint_room,
  stage: m.output_type_hint_stage,
  stream: m.output_type_hint_stream,
} as const;

const typeIcons = { room: MonitorPlay, stage: MonitorSpeaker, stream: Video } as const;

const selectClassName =
  "border-input bg-background h-8 border px-2 text-sm focus-visible:ring-1 focus-visible:outline-none";

function useCanManage() {
  const { data: member } = authClient.useActiveMember();
  return member?.role === "owner" || member?.role === "admin";
}

function OutputsPanel({ projectId }: { projectId: ProjectId }) {
  const canManage = useCanManage();
  return (
    <div className="space-y-4">
      {canManage && <NewOutputForm projectId={projectId} />}
      <OutputsList projectId={projectId} canManage={canManage} />
      <SplittingPanel canManage={canManage} />
    </div>
  );
}

function NewOutputForm({ projectId }: { projectId: ProjectId }) {
  const create = useAtomSet(createOutputAtom, { mode: "promiseExit" });
  const [name, setName] = useState("");
  const [type, setType] = useState<OutputType>("stream");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-2 border p-4"
      aria-label={m.outputs_new()}
      onSubmit={async (event) => {
        event.preventDefault();
        if (name.trim() === "") return;
        setPending(true);
        const exit = await create({
          payload: { projectId, name: name.trim(), type },
          reactivityKeys: outputsReactivity,
        });
        setPending(false);
        if (Exit.isSuccess(exit)) {
          toast.success(m.outputs_created({ name: exit.value.name }));
          setName("");
        } else {
          toast.error(m.outputs_action_error());
        }
      }}
    >
      <div className="min-w-48 flex-1 space-y-1">
        <Label htmlFor="output-name">{m.outputs_name()}</Label>
        <Input
          id="output-name"
          required
          maxLength={60}
          placeholder={m.outputs_name_placeholder()}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="output-type">{m.outputs_type()}</Label>
        <select
          id="output-type"
          className={selectClassName}
          value={type}
          onChange={(event) => setType(event.target.value as OutputType)}
        >
          {outputTypes.map((option) => (
            <option key={option} value={option}>
              {typeLabels[option]()}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending || name.trim() === ""}>
        {m.outputs_create()}
      </Button>
      <p className="text-muted-foreground w-full text-xs">{typeHints[type]()}</p>
    </form>
  );
}

function OutputsList({ projectId, canManage }: { projectId: ProjectId; canManage: boolean }) {
  const result = useAtomValue(outputsListAtom(projectId));

  if (result._tag === "Initial") return <Loader />;
  if (result._tag === "Failure")
    return <p className="text-sm text-red-500">{m.outputs_load_error()}</p>;

  return (
    <ul className="space-y-3" data-testid="outputs">
      {result.value.map((output) => (
        <OutputCard key={output.id} output={output} canManage={canManage} />
      ))}
    </ul>
  );
}

function OutputCard({ output, canManage }: { output: Output; canManage: boolean }) {
  const identify = useAtomSet(identifyOutputAtom, { mode: "promiseExit" });
  const regenerate = useAtomSet(regenerateTokenAtom, { mode: "promiseExit" });
  const rename = useAtomSet(renameOutputAtom, { mode: "promiseExit" });
  const remove = useAtomSet(removeOutputAtom, { mode: "promiseExit" });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(output.name);
  const url = displayUrl(output);
  const Icon = typeIcons[output.type];

  return (
    <li className="space-y-3 border p-4" data-output-type={output.type}>
      <div className="flex items-center gap-3">
        <Icon className="text-muted-foreground size-5" aria-hidden />
        {editing ? (
          <form
            className="flex min-w-0 flex-1 flex-wrap gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (name.trim() === "") return;
              const exit = await rename({
                payload: { id: output.id, name: name.trim() },
                reactivityKeys: outputsReactivity,
              });
              if (Exit.isSuccess(exit)) {
                toast.success(m.outputs_renamed());
                setEditing(false);
              } else {
                toast.error(m.outputs_action_error());
              }
            }}
          >
            <Input
              aria-label={m.outputs_name()}
              className="min-w-40 flex-1"
              required
              maxLength={60}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button type="submit" size="sm">
              {m.outputs_save()}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setName(output.name);
                setEditing(false);
              }}
            >
              {m.outputs_cancel()}
            </Button>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="font-medium">{output.name}</p>
            <p className="text-muted-foreground text-xs">
              {typeLabels[output.type]()} · {typeHints[output.type]()}
            </p>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">{m.outputs_link_label()}</p>
        <code className="bg-muted block truncate px-2 py-1 text-xs" data-testid="output-url">
          {url}
        </code>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            navigator.clipboard.writeText(url).then(() => toast.success(m.outputs_link_copied()))
          }
        >
          <Copy className="size-4" aria-hidden />
          {m.outputs_copy_link()}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          <ExternalLink className="size-4" aria-hidden />
          {m.outputs_open()}
        </a>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const exit = await identify({ payload: { id: output.id } });
            if (Exit.isSuccess(exit)) toast.success(m.outputs_identified({ name: output.name }));
            else toast.error(m.outputs_action_error());
          }}
        >
          <ScanEye className="size-4" aria-hidden />
          {m.outputs_identify()}
        </Button>
        {canManage && (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden />
              {m.outputs_rename()}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!window.confirm(m.outputs_regenerate_confirm())) return;
                const exit = await regenerate({
                  payload: { id: output.id },
                  reactivityKeys: outputsReactivity,
                });
                if (Exit.isSuccess(exit)) toast.success(m.outputs_regenerated());
                else toast.error(m.outputs_action_error());
              }}
            >
              <RefreshCw className="size-4" aria-hidden />
              {m.outputs_regenerate()}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                if (!window.confirm(m.outputs_remove_confirm({ name: output.name }))) return;
                const exit = await remove({
                  payload: { id: output.id },
                  reactivityKeys: outputsReactivity,
                });
                if (Exit.isSuccess(exit)) {
                  toast.success(m.outputs_removed());
                  return;
                }
                const error = Exit.isFailure(exit)
                  ? Cause.findErrorOption(exit.cause)
                  : Option.none();
                toast.error(
                  Option.isSome(error) && error.value._tag === "LastOutput"
                    ? m.outputs_last_output()
                    : m.outputs_action_error(),
                );
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              {m.outputs_remove()}
            </Button>
          </>
        )}
      </div>
      {canManage && (
        <details>
          <summary className="cursor-pointer text-sm select-none">{m.theme_title()}</summary>
          <ThemeEditor output={output} />
        </details>
      )}
    </li>
  );
}

function SplittingPanel({ canManage }: { canManage: boolean }) {
  const result = useAtomValue(splittingAtom);

  return (
    <section className="space-y-3 border p-4" aria-labelledby="splitting-title">
      <div className="space-y-1">
        <h2 id="splitting-title" className="font-medium">
          {m.splitting_title()}
        </h2>
        <p className="text-muted-foreground text-xs">{m.splitting_intro()}</p>
      </div>
      {result._tag !== "Success" ? (
        <Loader />
      ) : (
        <SplittingForm
          // Recrée le formulaire quand les réglages enregistrés changent.
          key={JSON.stringify(result.value)}
          initial={result.value}
          canManage={canManage}
        />
      )}
    </section>
  );
}

function SplittingForm({ initial, canManage }: { initial: SplittingSettings; canManage: boolean }) {
  const update = useAtomSet(updateSplittingAtom, { mode: "promiseExit" });
  const refreshLive = useAtomSet(liveRefreshAtom, { mode: "promiseExit" });
  const [settings, setSettings] = useState(initial);
  const [pending, setPending] = useState(false);

  const field = (track: keyof SplittingSettings, key: keyof Splitting) => {
    const id = `splitting-${track}-${key}`;
    const bounds = key === "songMaxLines" ? { min: 1, max: 12 } : { min: 40, max: 1000 };
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>
          {key === "songMaxLines" ? m.splitting_song_lines() : m.splitting_scripture_characters()}
        </Label>
        <Input
          id={id}
          type="number"
          required
          step={1}
          {...bounds}
          disabled={!canManage}
          value={settings[track][key]}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              [track]: { ...current[track], [key]: event.target.valueAsNumber },
            }))
          }
        />
      </div>
    );
  };

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const exit = await update({ payload: settings, reactivityKeys: splittingReactivity });
        setPending(false);
        if (Exit.isSuccess(exit)) {
          toast.success(m.splitting_saved());
          // Une régie en cours relit le projet avec le nouveau découpage.
          void refreshLive({ payload: undefined });
        } else {
          toast.error(m.outputs_action_error());
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(["room", "stream"] as const).map((track) => (
          <fieldset key={track} className="space-y-2">
            <legend className="text-sm font-medium">
              {track === "room" ? m.splitting_room() : m.splitting_stream()}
            </legend>
            {field(track, "songMaxLines")}
            {field(track, "scriptureMaxCharacters")}
          </fieldset>
        ))}
      </div>
      {canManage ? (
        <Button type="submit" size="sm" disabled={pending}>
          {m.outputs_save()}
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">{m.splitting_readonly()}</p>
      )}
    </form>
  );
}
