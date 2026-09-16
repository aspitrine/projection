import { useAtomSet } from "@effect/atom-react";
import { buttonVariants } from "@projection/ui/components/button";
import { useNavigate } from "@tanstack/react-router";
import { Cause, Exit, Option } from "effect";
import { FileUp } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages";

import { importAgendaAtom, projectsReactivity } from "./atoms";

/** Le fichier est binaire : il voyage en base64 dans l'appel RPC. */
const toBase64 = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/** Import d'un agenda VideoPsalm : chants ajoutés à la bibliothèque puis projet créé. */
export function ImportAgendaPanel() {
  const inputId = useId();
  const navigate = useNavigate();
  const importAgenda = useAtomSet(importAgendaAtom, { mode: "promiseExit" });
  const [pending, setPending] = useState(false);

  const run = async (file: File) => {
    setPending(true);
    const exit = await importAgenda({
      payload: { fileName: file.name, content: await toBase64(file) },
      reactivityKeys: projectsReactivity,
    });
    setPending(false);

    if (Exit.isFailure(exit)) {
      const error = Cause.findErrorOption(exit.cause);
      toast.error(
        Option.isSome(error) &&
          error.value._tag === "InvalidVideoPsalm" &&
          error.value.reason === "NoSongs"
          ? m.projects_import_no_songs()
          : m.projects_import_failed(),
      );
      return;
    }

    const report = exit.value;
    toast.success(
      m.projects_import_done({
        name: report.projectName,
        imported: report.imported.length,
        reused: report.reused.length,
      }),
    );
    if (report.errors.length > 0) {
      toast.warning(m.projects_import_errors({ count: report.errors.length }));
    }
    navigate({ to: "/projects/$projectId", params: { projectId: report.projectId } });
  };

  return (
    <section className="space-y-2 border p-4" data-testid="agenda-import">
      <h2 className="font-medium">{m.projects_import()}</h2>
      <p className="text-muted-foreground text-xs">{m.projects_import_hint()}</p>
      <label
        htmlFor={inputId}
        className={buttonVariants({ variant: "outline", className: "cursor-pointer" })}
      >
        <FileUp className="size-4" aria-hidden />
        {pending ? m.projects_import_running() : m.projects_import_choose()}
      </label>
      <input
        id={inputId}
        type="file"
        accept=".vpagd"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) void run(file);
        }}
      />
    </section>
  );
}
