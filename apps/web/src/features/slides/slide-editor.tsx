import type { SlideLayout } from "@projection/presentation/domain";
import { hasVisibleContent, parseRichText } from "@projection/slides/domain";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { SlideRenderer } from "@/features/presentation/slide-renderer";
import { m } from "@/paraglide/messages";

import { RichTextEditor } from "./rich-text-editor";

export interface SlideFormValues {
  readonly title: string;
  readonly source: string;
  readonly layout: SlideLayout;
}

export const emptySlideForm: SlideFormValues = { title: "", source: "", layout: "free" };

export const toSlideInput = (values: SlideFormValues) => ({
  title: values.title.trim(),
  source: values.source,
  layout: values.layout,
});

const layouts: ReadonlyArray<{ readonly value: SlideLayout; readonly label: () => string }> = [
  { value: "free", label: m.slide_layout_free },
  { value: "title", label: m.slide_layout_title },
  { value: "titleBody", label: m.slide_layout_titleBody },
  { value: "quote", label: m.slide_layout_quote },
];

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

  const blocks = useMemo(() => parseRichText(values.source), [values.source]);
  const hasContent = hasVisibleContent(values.source);
  const canSubmit = values.title.trim() !== "" && hasContent && !submitting;

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
            <Label id="slide-source-label">{m.slide_field_content()}</Label>
            <RichTextEditor
              value={values.source}
              labelledBy="slide-source-label"
              describedBy="slide-source-help"
              onChange={(source) => setValues((current) => ({ ...current, source }))}
            />
            <p id="slide-source-help" className="text-muted-foreground text-xs">
              {m.slide_help()}
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{m.slide_field_layout()}</legend>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label={m.slide_field_layout()}
            >
              {layouts.map((layout) => (
                <Button
                  key={layout.value}
                  type="button"
                  role="radio"
                  aria-checked={values.layout === layout.value}
                  data-testid={`slide-layout-${layout.value}`}
                  variant={values.layout === layout.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setValues((current) => ({ ...current, layout: layout.value }))}
                >
                  {layout.label()}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{m.slide_layout_help()}</p>
          </fieldset>

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
              slide={{ kind: "rich", blocks, layout: values.layout }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">{m.slide_content_hint()}</p>
          )}
        </section>
      </div>
    </div>
  );
}
