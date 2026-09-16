import { useAtomSet } from "@effect/atom-react";
import { type Output, defaultThemeFor } from "@projection/outputs/domain";
import { SlideTheme } from "@projection/presentation/domain";
import { Button } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { Exit } from "effect";
import { RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { contentToSlide } from "@/features/display/frame";
import { SlideRenderer } from "@/features/presentation/slide-renderer";
import { m } from "@/paraglide/messages";

import { outputsReactivity, setOutputThemeAtom } from "./atoms";

/** Diapo d'exemple de l'aperçu : représentative d'un refrain projeté. */
const sample = contentToSlide({
  _tag: "Lines",
  lines: ["Il est bon de louer le Seigneur", "Et de chanter le nom du Dieu le plus haut"],
  caption: "Refrain",
});

type NumberField = "paddingPercent" | "minFontSize" | "maxFontSize" | "lineHeight" | "transitionMs";

const numberFields: ReadonlyArray<{
  readonly name: NumberField;
  readonly label: () => string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}> = [
  { name: "minFontSize", label: m.theme_min_font, min: 1, max: 20, step: 0.5 },
  { name: "maxFontSize", label: m.theme_max_font, min: 2, max: 30, step: 0.5 },
  { name: "lineHeight", label: m.theme_line_height, min: 1, max: 2.5, step: 0.05 },
  { name: "paddingPercent", label: m.theme_padding, min: 0, max: 20, step: 1 },
  { name: "transitionMs", label: m.theme_transition, min: 0, max: 2000, step: 50 },
];

/** Éditeur de thème d'une sortie, avec aperçu en direct et retour aux valeurs par défaut. */
export function ThemeEditor({ output }: { output: Output }) {
  const fieldId = useId();
  const save = useAtomSet(setOutputThemeAtom, { mode: "promiseExit" });
  const [theme, setTheme] = useState<SlideTheme>(output.theme ?? defaultThemeFor(output.type));
  const [pending, setPending] = useState(false);

  const set = <K extends keyof SlideTheme>(name: K, value: SlideTheme[K]) =>
    setTheme((current) => new SlideTheme({ ...current, [name]: value }));

  const apply = async (next: SlideTheme | null) => {
    setPending(true);
    const exit = await save({
      payload: { id: output.id, theme: next },
      reactivityKeys: outputsReactivity,
    });
    setPending(false);
    if (Exit.isSuccess(exit)) {
      setTheme(next ?? defaultThemeFor(output.type));
      toast.success(next === null ? m.theme_reset_done() : m.theme_saved());
    } else {
      toast.error(m.outputs_action_error());
    }
  };

  return (
    <div className="grid gap-4 border-t pt-3 lg:grid-cols-[1fr_16rem]">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-background`}>{m.theme_background()}</Label>
            <Input
              id={`${fieldId}-background`}
              value={theme.background}
              onChange={(event) => set("background", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-color`}>{m.theme_color()}</Label>
            <Input
              id={`${fieldId}-color`}
              value={theme.color}
              onChange={(event) => set("color", event.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${fieldId}-font`}>{m.theme_font()}</Label>
            <Input
              id={`${fieldId}-font`}
              value={theme.fontFamily}
              onChange={(event) => set("fontFamily", event.target.value)}
            />
          </div>
          {numberFields.map(({ name, label, min, max, step }) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={`${fieldId}-${name}`}>{label()}</Label>
              <Input
                id={`${fieldId}-${name}`}
                type="number"
                min={min}
                max={max}
                step={step}
                value={theme[name]}
                onChange={(event) =>
                  set(
                    name,
                    name === "transitionMs"
                      ? Math.round(event.target.valueAsNumber || 0)
                      : (event.target.valueAsNumber ?? 0),
                  )
                }
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-align`}>{m.theme_align()}</Label>
            <select
              id={`${fieldId}-align`}
              className="border-input bg-background h-8 w-full border px-2 text-sm"
              value={theme.textAlign}
              onChange={(event) => set("textAlign", event.target.value as SlideTheme["textAlign"])}
            >
              <option value="left">{m.theme_align_left()}</option>
              <option value="center">{m.theme_align_center()}</option>
              <option value="right">{m.theme_align_right()}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-vertical`}>{m.theme_vertical()}</Label>
            <select
              id={`${fieldId}-vertical`}
              className="border-input bg-background h-8 w-full border px-2 text-sm"
              value={theme.verticalAlign}
              onChange={(event) =>
                set("verticalAlign", event.target.value as SlideTheme["verticalAlign"])
              }
            >
              <option value="top">{m.theme_vertical_top()}</option>
              <option value="center">{m.theme_vertical_center()}</option>
              <option value="bottom">{m.theme_vertical_bottom()}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={theme.textShadow}
              onChange={(event) => set("textShadow", event.target.checked)}
            />
            {m.theme_shadow()}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={theme.showCaption}
              onChange={(event) => set("showCaption", event.target.checked)}
            />
            {m.theme_caption()}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={theme.textBackground !== null}
              onChange={(event) =>
                set("textBackground", event.target.checked ? "rgba(0, 0, 0, 0.6)" : null)
              }
            />
            {m.theme_text_background()}
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => apply(theme)}>
            {m.theme_save()}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => apply(null)}>
            <RotateCcw className="size-4" aria-hidden />
            {m.theme_reset()}
          </Button>
          {output.theme === null && (
            <span className="text-muted-foreground self-center text-xs">{m.theme_default()}</span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">{m.theme_preview()}</p>
        <SlideRenderer
          theme={theme}
          slide={sample}
          className="ring-1 ring-foreground/10"
          data-testid="theme-preview"
        />
      </div>
    </div>
  );
}
