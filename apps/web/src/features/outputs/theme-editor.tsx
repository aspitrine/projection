import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { type Output, defaultThemeFor } from "@projection/outputs/domain";
import { SlideTheme } from "@projection/presentation/domain";
import { Button } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { Exit } from "effect";
import { RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { MediaId } from "@projection/shared-kernel";

import { contentToSlide } from "@/features/display/frame";
import { mediaListAtom, mediaUrlAtom } from "@/features/media/atoms";
import { SlideRenderer } from "@/features/presentation/slide-renderer";
import { m } from "@/paraglide/messages";

import { outputsReactivity, setOutputThemeAtom } from "./atoms";

/** Diapo d'exemple de l'aperçu : représentative d'un refrain projeté. */
const sample = contentToSlide({
  _tag: "Lines",
  lines: ["Il est bon de louer le Seigneur", "Et de chanter le nom du Dieu le plus haut"],
  caption: "Refrain",
});

/** Piles sûres : disponibles sur les postes de projection sans téléchargement. */
const fontStacks: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
  { label: "Inter / système", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

const weights: ReadonlyArray<{ readonly value: number; readonly label: () => string }> = [
  { value: 400, label: m.theme_weight_regular },
  { value: 500, label: m.theme_weight_medium },
  { value: 600, label: m.theme_weight_semibold },
  { value: 700, label: m.theme_weight_bold },
];

/** Un sélecteur de couleur ne comprend que `#rrggbb` ; « transparent » reste au clavier. */
const hexOrNull = (value: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value : null);

const selectClassName = "border-input bg-background h-8 w-full border px-2 text-sm";

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

  const library = useAtomValue(mediaListAtom);
  const backgroundChoices = library._tag === "Success" ? library.value : [];

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
          <ColorField
            id={`${fieldId}-background`}
            label={m.theme_background()}
            value={theme.background}
            onChange={(value) => set("background", value)}
          />
          <ColorField
            id={`${fieldId}-color`}
            label={m.theme_color()}
            value={theme.color}
            onChange={(value) => set("color", value)}
          />
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-font`}>{m.theme_font()}</Label>
            <select
              id={`${fieldId}-font`}
              className={selectClassName}
              value={
                fontStacks.some((font) => font.value === theme.fontFamily) ? theme.fontFamily : ""
              }
              onChange={(event) => set("fontFamily", event.target.value)}
            >
              {!fontStacks.some((font) => font.value === theme.fontFamily) && (
                <option value="">{m.theme_font_custom()}</option>
              )}
              {fontStacks.map((font) => (
                <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-weight`}>{m.theme_weight()}</Label>
            <select
              id={`${fieldId}-weight`}
              className={selectClassName}
              value={theme.fontWeight}
              onChange={(event) => set("fontWeight", Number(event.target.value))}
            >
              {weights.map((weight) => (
                <option key={weight.value} value={weight.value}>
                  {weight.label()}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${fieldId}-font-custom`}>{m.theme_font_custom()}</Label>
            <Input
              id={`${fieldId}-font-custom`}
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-media`}>{m.theme_background_media()}</Label>
            <select
              id={`${fieldId}-media`}
              className={selectClassName}
              value={theme.backgroundMediaId ?? ""}
              onChange={(event) =>
                set("backgroundMediaId", event.target.value === "" ? null : event.target.value)
              }
            >
              <option value="">{m.theme_background_media_none()}</option>
              {backgroundChoices.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">{m.theme_background_media_hint()}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-dim`}>{m.theme_background_dim()}</Label>
            <Input
              id={`${fieldId}-dim`}
              type="number"
              min={0}
              max={100}
              step={5}
              value={Math.round(theme.backgroundDim * 100)}
              onChange={(event) =>
                set(
                  "backgroundDim",
                  Math.min(100, Math.max(0, event.target.valueAsNumber || 0)) / 100,
                )
              }
            />
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
        <ThemePreview theme={theme} />
      </div>
    </div>
  );
}

/** Champ couleur : sélecteur graphique quand la valeur est un hexadécimal, texte sinon. */
function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hex = hexOrNull(value);

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
        <input
          type="color"
          aria-label={m.theme_color_pick()}
          className="border-input size-8 shrink-0 border bg-transparent"
          value={hex ?? "#000000"}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

/** Aperçu de la diapo d'exemple, fond du thème compris. */
function ThemePreview({ theme }: { theme: SlideTheme }) {
  return theme.backgroundMediaId === null ? (
    <PreviewSlide theme={theme} background={null} />
  ) : (
    // Sous-composant : l'URL signée n'est demandée que lorsqu'un média est choisi.
    <PreviewWithBackground theme={theme} mediaId={MediaId.make(theme.backgroundMediaId)} />
  );
}

function PreviewWithBackground({ theme, mediaId }: { theme: SlideTheme; mediaId: MediaId }) {
  const url = useAtomValue(mediaUrlAtom(mediaId));
  const library = useAtomValue(mediaListAtom);
  const asset =
    library._tag === "Success"
      ? library.value.find((candidate) => candidate.id === mediaId)
      : undefined;

  return (
    <PreviewSlide
      theme={theme}
      background={
        url._tag === "Success" && asset !== undefined
          ? { url: url.value, video: asset.kind === "video" }
          : null
      }
    />
  );
}

function PreviewSlide({
  theme,
  background,
}: {
  theme: SlideTheme;
  background: { readonly url: string; readonly video: boolean } | null;
}) {
  return (
    <SlideRenderer
      theme={theme}
      slide={sample}
      background={background}
      className="ring-1 ring-foreground/10"
      data-testid="theme-preview"
    />
  );
}
