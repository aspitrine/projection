import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Project } from "@projection/projects/domain";
import { ProjectId } from "@projection/shared-kernel";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { ClientOnly, Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Exit, Option, Schema } from "effect";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import {
  deleteProjectAtom,
  projectAtom,
  projectsReactivity,
  updateProjectAtom,
} from "@/features/projects/atoms";
import { ProjectFormDialog } from "@/features/projects/project-form-dialog";
import { ProjectRegie } from "@/routes/_auth/_app/live";
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
    // Sur grand écran, la régie occupe la hauteur disponible : seule la diffusion défile.
    <div className="flex min-h-full flex-col lg:h-full">
      <ProjectRegie
        projectId={project.id}
        headerActions={
          <ProjectHeader key={`${project.id}-${project.name}-${project.date}`} project={project} />
        }
      />
    </div>
  );
}

function ProjectHeader({ project }: { project: Project }) {
  const navigate = useNavigate();
  const update = useAtomSet(updateProjectAtom, { mode: "promiseExit" });
  const remove = useAtomSet(deleteProjectAtom, { mode: "promiseExit" });
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={m.project_edit()}
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="destructive"
        aria-label={m.project_delete()}
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
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
      <ProjectFormDialog
        open={open}
        onOpenChange={setOpen}
        title={m.project_edit()}
        submitLabel={m.project_save()}
        initialName={project.name}
        initialDate={project.date}
        onSubmit={async ({ name, date }) => {
          const exit = await update({
            payload: {
              id: project.id,
              input: { name, date },
            },
            reactivityKeys: projectsReactivity,
          });
          if (Exit.isSuccess(exit)) {
            setOpen(false);
            toast.success(m.project_saved());
          } else toast.error(m.project_save_error());
        }}
      />
    </>
  );
}
