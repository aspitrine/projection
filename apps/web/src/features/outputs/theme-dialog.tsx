import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Output, SplittingSettings } from "@projection/outputs/domain";
import type { ProjectId } from "@projection/shared-kernel";
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
import { Exit } from "effect";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { liveRefreshAtom } from "@/features/live/atoms";
import { m } from "@/paraglide/messages";

import { outputsListAtom, splittingAtom, splittingReactivity, updateSplittingAtom } from "./atoms";
import { useCanManage } from "./can-manage";
import { ThemeEditor } from "./theme-editor";

const typeLabels = {
  room: m.output_type_room,
  stream: m.output_type_stream,
} as const;

/** Configuration d'affichage du projet : thème de chaque sortie et découpage des diapos. */
export function ThemeDialog({
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{m.project_theme_title()}</DialogTitle>
          <DialogDescription>{m.project_theme_description()}</DialogDescription>
        </DialogHeader>
        {open && <ThemePanel projectId={projectId} />}
      </DialogContent>
    </Dialog>
  );
}

function ThemePanel({ projectId }: { projectId: ProjectId }) {
  const canManage = useCanManage();
  const outputs = useAtomValue(outputsListAtom(projectId));

  return (
    <div className="space-y-4">
      {!canManage && <p className="text-muted-foreground text-sm">{m.project_theme_readonly()}</p>}
      {outputs._tag === "Initial" ? (
        <Loader />
      ) : outputs._tag === "Failure" ? (
        <p className="text-sm text-red-500">{m.outputs_load_error()}</p>
      ) : (
        outputs.value.map((output) => (
          <OutputThemeSection key={output.id} output={output} canManage={canManage} />
        ))
      )}
      <SplittingPanel canManage={canManage} />
    </div>
  );
}

function OutputThemeSection({ output, canManage }: { output: Output; canManage: boolean }) {
  return (
    <section className="space-y-2 border p-4" aria-label={`${m.theme_title()} : ${output.name}`}>
      <div>
        <h2 className="font-medium">{output.name}</h2>
        <p className="text-muted-foreground text-xs">{typeLabels[output.type]()}</p>
      </div>
      {canManage && <ThemeEditor output={output} />}
    </section>
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

  // Seules les lignes de chant se règlent : la Bible affiche toujours un verset par diapo.
  const field = (track: keyof SplittingSettings) => {
    const id = `splitting-${track}-songMaxLines`;
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{m.splitting_song_lines()}</Label>
        <Input
          id={id}
          type="number"
          required
          step={1}
          min={1}
          max={12}
          disabled={!canManage}
          value={settings[track].songMaxLines}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              [track]: { ...current[track], songMaxLines: event.target.valueAsNumber },
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
            {field(track)}
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
