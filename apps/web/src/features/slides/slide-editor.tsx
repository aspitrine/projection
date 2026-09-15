import { hasVisibleContent, parseRichText } from "@projection/slides/domain";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { Textarea } from "@projection/ui/components/textarea";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bold, Heading, Italic, List } from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";

import { SlideRenderer } from "@/features/presentation/slide-renderer";
import { m } from "@/paraglide/messages";

import { type MarkupEdit, togglePrefix, toggleWrap } from "./markup";

export interface SlideFormValues {
  readonly title: string;
  readonly source: string;
}

export const emptySlideForm: SlideFormValues = { title: "", source: "" };

export const toSlideInput = (values: SlideFormValues) => ({
  title: values.title.trim(),
  source: values.source,
});

export function SlideEditor({
  heading,
  initial,
  submitting,
  onSubmit,
  actions,
}: {
  heading: string;
  initial: SlideFormValues;
  submitting: boolean;
  onSubmit: (values: SlideFormValues) => void;
  actions?: ReactNode;
}) {
  const [values, setValues] = useState(initial);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const blocks = useMemo(() => parseRichText(values.source), [values.source]);
  const hasContent = hasVisibleContent(values.source);
  const canSubmit = values.title.trim() !== "" && hasContent && !submitting;

  const applyMarkup = (transform: (value: string, start: number, end: number) => MarkupEdit) => {
    const element = textarea.current;
    if (element === null) return;
    const edit = transform(element.value, element.selectionStart, element.selectionEnd);
    setValues((current) => ({ ...current, source: edit.value }));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };

  const tools = [
    {
      label: m.slide_bold(),
      icon: Bold,
      apply: (v: string, s: number, e: number) => toggleWrap(v, s, e, "**", m.slide_bold()),
    },
    {
      label: m.slide_italic(),
      icon: Italic,
      apply: (v: string, s: number, e: number) => toggleWrap(v, s, e, "*", m.slide_italic()),
    },
    {
      label: m.slide_heading(),
      icon: Heading,
      apply: (v: string, s: number, e: number) => togglePrefix(v, s, e, "# "),
    },
    {
      label: m.slide_list(),
      icon: List,
      apply: (v: string, s: number, e: number) => togglePrefix(v, s, e, "- "),
    },
  ];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <Link
          to="/library/slides"
          className={buttonVariants({ variant: "link", className: "px-0" })}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {m.slide_back()}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{heading}</h1>
          {actions}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit(values);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="slide-title">{m.slide_field_title()}</Label>
            <Input
              id="slide-title"
              required
              value={values.title}
              onChange={(event) =>
                setValues((current) => ({ ...current, title: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slide-source">{m.slide_field_content()}</Label>
            <div role="toolbar" aria-label={m.slide_toolbar()} className="flex gap-1">
              {tools.map(({ label, icon: Icon, apply }) => (
                <Button
                  key={label}
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={label}
                  title={label}
                  onClick={() => applyMarkup(apply)}
                >
                  <Icon className="size-4" aria-hidden />
                </Button>
              ))}
            </div>
            <Textarea
              ref={textarea}
              id="slide-source"
              aria-describedby="slide-source-help"
              className="min-h-64 font-mono text-sm"
              value={values.source}
              onChange={(event) =>
                setValues((current) => ({ ...current, source: event.target.value }))
              }
            />
            <p id="slide-source-help" className="text-muted-foreground text-xs">
              {m.slide_help()}
            </p>
          </div>

          <Button type="submit" disabled={!canSubmit}>
            {submitting ? m.slide_saving() : m.slide_save()}
          </Button>
        </form>

        <section className="space-y-3" aria-label={m.slide_preview()}>
          <h2 className="font-medium">{m.slide_preview()}</h2>
          {hasContent ? (
            <SlideRenderer
              data-testid="text-slide-preview"
              className="ring-1 ring-foreground/10"
              slide={{ kind: "rich", blocks }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">{m.slide_content_hint()}</p>
          )}
        </section>
      </div>
    </div>
  );
}
