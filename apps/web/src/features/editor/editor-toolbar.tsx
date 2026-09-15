import { Button } from "@projection/ui/components/button";
import { cn } from "@projection/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Bouton de barre d'outils d'éditeur, avec état actif. */
export function ToolbarButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <Button
      type="button"
      size={Icon !== undefined && children === undefined ? "icon" : "sm"}
      variant={active ? "secondary" : "ghost"}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      // Garde la sélection de l'éditeur au clic.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(active && "ring-1 ring-foreground/20")}
    >
      {Icon !== undefined && <Icon className="size-4" aria-hidden />}
      {children}
    </Button>
  );
}

export const editorFrameClassName =
  "border-input bg-background focus-within:ring-ring/50 border focus-within:ring-2";
