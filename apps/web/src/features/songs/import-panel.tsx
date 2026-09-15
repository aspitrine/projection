import { useAtomSet } from "@effect/atom-react";
import type { ImportReport } from "@projection/songs/domain";
import { buttonVariants } from "@projection/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Exit } from "effect";
import { FileUp } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages";

import { importSongsAtom, songsReactivity } from "./atoms";

const MAX_FILES = 50;
const MAX_BYTES = 200_000;
const ACCEPT = ".cho,.chordpro,.chopro,.crd,.pro,.txt";

type ErrorReason = ImportReport["errors"][number]["reason"] | "TooLarge";

interface Report {
  readonly imported: ImportReport["imported"];
  readonly duplicates: ImportReport["duplicates"];
  readonly errors: ReadonlyArray<{ readonly fileName: string; readonly reason: ErrorReason }>;
}

const reasonLabels: Record<ErrorReason, () => string> = {
  NoLyrics: m.songs_import_reason_no_lyrics,
  Empty: m.songs_import_reason_no_lyrics,
  DuplicateSection: m.songs_import_reason_duplicate_section,
  UndefinedRepeat: m.songs_import_reason_undefined_repeat,
  TooLarge: m.songs_import_reason_too_large,
};

/** Import de fichiers ChordPro avec rapport : importés, doublons ignorés, erreurs. */
export function SongImportPanel() {
  const inputId = useId();
  const importSongs = useAtomSet(importSongsAtom, { mode: "promiseExit" });
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const importFiles = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      toast.error(m.songs_import_too_many({ max: MAX_FILES }));
      return;
    }

    setPending(true);
    const tooLarge = files
      .filter((file) => file.size > MAX_BYTES)
      .map((file) => ({ fileName: file.name, reason: "TooLarge" as const }));
    const readable = await Promise.all(
      files
        .filter((file) => file.size <= MAX_BYTES)
        .map(async (file) => ({ fileName: file.name, content: await file.text() })),
    );

    if (readable.length === 0) {
      setReport({ imported: [], duplicates: [], errors: tooLarge });
      setPending(false);
      return;
    }

    const exit = await importSongs({
      payload: { format: "chordpro", files: readable },
      reactivityKeys: songsReactivity,
    });
    setPending(false);
    if (Exit.isSuccess(exit)) {
      setReport({
        imported: exit.value.imported,
        duplicates: exit.value.duplicates,
        errors: [...exit.value.errors, ...tooLarge],
      });
    } else {
      toast.error(m.songs_import_failed());
    }
  };

  return (
    <section
      className="space-y-3 border p-4"
      aria-labelledby={`${inputId}-title`}
      data-testid="song-import"
    >
      <div className="space-y-1">
        <h2 id={`${inputId}-title`} className="font-medium">
          {m.songs_import_title()}
        </h2>
        <p className="text-muted-foreground text-xs">{m.songs_import_hint({ max: MAX_FILES })}</p>
      </div>
      <label
        htmlFor={inputId}
        className={buttonVariants({ variant: "outline", className: "cursor-pointer" })}
      >
        <FileUp className="size-4" aria-hidden />
        {pending ? m.songs_import_running() : m.songs_import_choose()}
      </label>
      <input
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          void importFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {report !== null && (
        <div className="space-y-3 text-sm" data-testid="song-import-report" aria-live="polite">
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-green-600 dark:text-green-400">
              {m.songs_import_imported({ count: report.imported.length })}
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              {m.songs_import_duplicates({ count: report.duplicates.length })}
            </span>
            <span className="text-red-600 dark:text-red-400">
              {m.songs_import_errors({ count: report.errors.length })}
            </span>
          </p>
          <ul className="divide-y border text-xs">
            {report.imported.map((entry) => (
              <li key={`ok-${entry.fileName}`} className="flex flex-wrap gap-2 p-2">
                <span className="text-muted-foreground">{entry.fileName}</span>
                <Link
                  to="/library/songs/$songId"
                  params={{ songId: entry.id }}
                  className="font-medium hover:underline"
                >
                  {entry.title}
                </Link>
              </li>
            ))}
            {report.duplicates.map((entry) => (
              <li key={`dup-${entry.fileName}`} className="flex flex-wrap gap-2 p-2">
                <span className="text-muted-foreground">{entry.fileName}</span>
                <span>{m.songs_import_duplicate_of({ title: entry.title })}</span>
              </li>
            ))}
            {report.errors.map((entry) => (
              <li key={`err-${entry.fileName}`} className="flex flex-wrap gap-2 p-2">
                <span className="text-muted-foreground">{entry.fileName}</span>
                <span className="text-red-600 dark:text-red-400">
                  {reasonLabels[entry.reason]()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
