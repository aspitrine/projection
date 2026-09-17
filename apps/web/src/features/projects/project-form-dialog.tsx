import { Button } from "@projection/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@projection/ui/components/dialog";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { useEffect, useState } from "react";

import { m } from "@/paraglide/messages";

type ProjectFormValues = { name: string; date: string | null };

export function ProjectFormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initialName = "",
  initialDate = null,
  pending = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  initialName?: string;
  initialDate?: string | null;
  pending?: boolean;
  onSubmit: (values: ProjectFormValues) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [date, setDate] = useState(initialDate ?? "");

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDate(initialDate ?? "");
  }, [initialDate, initialName, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (name.trim() === "") return;
            await onSubmit({ name: name.trim(), date: date === "" ? null : date });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="project-name">{m.projects_name()}</Label>
            <Input
              id="project-name"
              autoFocus
              required
              placeholder={m.projects_name_placeholder()}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-date">{m.projects_date()}</Label>
            <Input
              id="project-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || name.trim() === ""}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
