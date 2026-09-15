import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Output } from "@projection/outputs/domain";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Exit } from "effect";
import { Copy, ExternalLink, MonitorPlay, RefreshCw, ScanEye } from "lucide-react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import {
  identifyOutputAtom,
  outputsListAtom,
  outputsReactivity,
  regenerateTokenAtom,
} from "@/features/outputs/atoms";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/outputs")({
  component: () => (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{m.nav_outputs()}</h1>
        <p className="text-muted-foreground text-sm">{m.outputs_intro()}</p>
      </div>
      <ClientOnly fallback={<Loader />}>
        <OutputsList />
      </ClientOnly>
    </div>
  ),
});

const displayUrl = (output: Output) =>
  new URL(`/display/${output.token}`, window.location.origin).href;

const typeLabels = { room: m.output_type_room } as const;

function OutputsList() {
  const result = useAtomValue(outputsListAtom);
  const { data: member } = authClient.useActiveMember();
  const canManage = member?.role === "owner" || member?.role === "admin";

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
  const url = displayUrl(output);

  return (
    <li className="space-y-3 border p-4">
      <div className="flex items-center gap-3">
        <MonitorPlay className="text-muted-foreground size-5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{output.name}</p>
          <p className="text-muted-foreground text-xs">{typeLabels[output.type]()}</p>
        </div>
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
          <Button
            size="sm"
            variant="destructive"
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
        )}
      </div>
    </li>
  );
}
