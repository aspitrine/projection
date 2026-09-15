import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Project } from "@projection/projects/domain";
import { ProjectId } from "@projection/shared-kernel";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { ClientOnly, Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Exit, Option, Schema } from "effect";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { AddItemPanel } from "@/features/projects/add-item-panel";
import {
  deleteProjectAtom,
  projectAtom,
  projectsReactivity,
  updateProjectAtom,
} from "@/features/projects/atoms";
import { ProjectItems } from "@/features/projects/project-items";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/projects/$projectId")({
  component: () => (
    <ClientOnly fallback={<Loader />}>
      <ProjectPage />
    </ClientOnly>
  ),
});

const decodeProjectId = Schema.decodeUnknownOption(ProjectId);

function BackLink() {
  return (
    <Link to="/projects" className={buttonVariants({ variant: "link", className: "px-0" })}>
      <ArrowLeft className="size-4" aria-hidden />
      {m.project_back()}
    </Link>
  );
}

function NotFound() {
  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <p>{m.project_not_found()}</p>
      <BackLink />
    </div>
  );
}

function ProjectPage() {
  const { projectId } = Route.useParams();
  return Option.match(decodeProjectId(projectId), {
    onNone: () => <NotFound />,
    onSome: (id) => <LoadedProject id={id} />,
  });
}

function LoadedProject({ id }: { id: ProjectId }) {
  const result = useAtomValue(projectAtom(id));
  if (result._tag === "Initial") return <Loader />;
  if (result._tag === "Failure") return <NotFound />;
  const project = result.value;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
      <BackLink />
      <ProjectHeader key={`${project.id}-${project.name}-${project.date}`} project={project} />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <ProjectItems project={project} />
        <AddItemPanel projectId={project.id} />
      </div>
    </div>
  );
}

function ProjectHeader({ project }: { project: Project }) {
  const navigate = useNavigate();
  const update = useAtomSet(updateProjectAtom, { mode: "promiseExit" });
  const remove = useAtomSet(deleteProjectAtom, { mode: "promiseExit" });
  const [name, setName] = useState(project.name);
  const [date, setDate] = useState(project.date ?? "");
  const dirty = name.trim() !== project.name || (date === "" ? null : date) !== project.date;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (name.trim() === "") return;
        const exit = await update({
          payload: {
            id: project.id,
            input: { name: name.trim(), date: date === "" ? null : date },
          },
          reactivityKeys: projectsReactivity,
        });
        if (Exit.isSuccess(exit)) toast.success(m.project_saved());
        else toast.error(m.project_save_error());
      }}
    >
      <div className="min-w-56 flex-1 space-y-1">
        <Label htmlFor="project-name">{m.projects_name()}</Label>
        <Input
          id="project-name"
          className="h-10 text-lg font-semibold"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="project-date">{m.projects_date()}</Label>
        <Input
          id="project-date"
          type="date"
          className="h-10"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      <Button type="submit" size="lg" disabled={!dirty || name.trim() === ""}>
        {m.project_save()}
      </Button>
      <Button
        type="button"
        size="lg"
        variant="destructive"
        onClick={async () => {
          if (!window.confirm(m.project_delete_confirm({ name: project.name }))) return;
          const exit = await remove({
            payload: { id: project.id },
            reactivityKeys: projectsReactivity,
          });
          if (Exit.isSuccess(exit)) {
            toast.success(m.project_deleted());
            navigate({ to: "/projects" });
          } else {
            toast.error(m.project_action_error());
          }
        }}
      >
        <Trash2 className="size-4" aria-hidden />
        {m.project_delete()}
      </Button>
    </form>
  );
}
