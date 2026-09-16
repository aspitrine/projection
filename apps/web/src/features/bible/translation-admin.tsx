import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Translation } from "@projection/bible/domain";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { Cause, Exit, Option } from "effect";
import { FileUp } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

import {
  bibleReactivity,
  defaultTranslationAtom,
  importTranslationAtom,
  setDefaultTranslationAtom,
} from "./atoms";

/** 30 Mo : une Bible complète en OSIS ou Zefania y tient largement. */
const MAX_BYTES = 30_000_000;

const emptyForm = { code: "", name: "", language: "fr", license: "" };

/**
 * Réservé aux propriétaires et administrateurs : import d'une traduction dont
 * l'organisation détient les droits, et choix de la traduction proposée par défaut.
 */
export function TranslationAdmin({ translations }: { translations: ReadonlyArray<Translation> }) {
  const fieldId = useId();
  const { data: member } = authClient.useActiveMember();
  const canManage = member?.role === "owner" || member?.role === "admin";
  const current = useAtomValue(defaultTranslationAtom);
  const importTranslation = useAtomSet(importTranslationAtom, { mode: "promiseExit" });
  const setDefault = useAtomSet(setDefaultTranslationAtom, { mode: "promiseExit" });
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);

  if (!canManage) return null;

  const complete = Object.values(form).every((value) => value.trim() !== "");

  const importFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error(m.bible_import_too_large());
      return;
    }
    setPending(true);
    const exit = await importTranslation({
      payload: { input: form, content: await file.text() },
      reactivityKeys: bibleReactivity,
    });
    setPending(false);

    if (Exit.isSuccess(exit)) {
      toast.success(m.bible_import_done({ books: exit.value.books, verses: exit.value.verses }));
      setForm(emptyForm);
      return;
    }
    const error = Cause.findErrorOption(exit.cause);
    toast.error(
      Option.isSome(error) && error.value._tag === "InvalidTranslationFile"
        ? m.bible_import_unreadable()
        : m.bible_import_failed(),
    );
  };

  return (
    <section className="space-y-3 border p-4" data-testid="bible-admin">
      <div className="space-y-1">
        <h2 className="font-medium">{m.bible_import_title()}</h2>
        <p className="text-muted-foreground text-xs">{m.bible_import_hint()}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["code", m.bible_field_code()],
            ["name", m.bible_field_name()],
            ["language", m.bible_field_language()],
            ["license", m.bible_field_license()],
          ] as const
        ).map(([name, label]) => (
          <div key={name} className="space-y-1">
            <Label htmlFor={`${fieldId}-${name}`}>{label}</Label>
            <Input
              id={`${fieldId}-${name}`}
              value={form[name]}
              onChange={(event) =>
                setForm((current) => ({ ...current, [name]: event.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <label
        htmlFor={`${fieldId}-file`}
        className={buttonVariants({
          variant: "outline",
          className: complete && !pending ? "cursor-pointer" : "pointer-events-none opacity-50",
        })}
      >
        <FileUp className="size-4" aria-hidden />
        {pending ? m.bible_import_running() : m.bible_import_choose()}
      </label>
      <input
        id={`${fieldId}-file`}
        type="file"
        accept=".xml,.usfm,.sfm,.txt"
        className="sr-only"
        disabled={!complete || pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) void importFile(file);
        }}
      />

      {translations.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-default`}>{m.bible_default_translation()}</Label>
            <select
              id={`${fieldId}-default`}
              className="border-input bg-background h-8 border px-2 text-sm"
              value={current._tag === "Success" ? (current.value ?? "") : ""}
              onChange={async (event) => {
                const exit = await setDefault({
                  payload: { translationId: event.target.value },
                  reactivityKeys: bibleReactivity,
                });
                if (Exit.isSuccess(exit)) toast.success(m.bible_default_saved());
                else toast.error(m.bible_import_failed());
              }}
            >
              {translations.map((translation) => (
                <option key={translation.id} value={translation.id}>
                  {translation.name} ({translation.code})
                </option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const exit = await setDefault({
                payload: { translationId: null },
                reactivityKeys: bibleReactivity,
              });
              if (Exit.isSuccess(exit)) toast.success(m.bible_default_cleared());
            }}
          >
            {m.bible_default_clear()}
          </Button>
        </div>
      )}
    </section>
  );
}
