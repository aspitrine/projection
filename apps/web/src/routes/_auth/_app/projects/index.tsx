import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@projection/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@projection/ui/components/empty";
import { ClientOnly, Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Exit } from "effect";
import { FolderKanban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { createProjectAtom, projectsListAtom, projectsReactivity } from "@/features/projects/atoms";
import { formatProjectDate } from "@/features/projects/format";
import { ImportAgendaPanel } from "@/features/projects/import-agenda";
import { ProjectFormDialog } from "@/features/projects/project-form-dialog";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/projects/")({
  component: () => (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">{m.nav_projects()}</h1>
      <ClientOnly fallback={<Loader />}>
        <NewProjectDialog />
        <ImportAgendaPanel />
        <ProjectsTable />
      </ClientOnly>
    </div>
  ),
});

function NewProjectDialog() {
  const navigate = useNavigate();
  const create = useAtomSet(createProjectAtom, { mode: "promiseExit" });
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {m.projects_create()}
      </Button>
      <ProjectFormDialog
        open={open}
        onOpenChange={setOpen}
        title={m.projects_create()}
        submitLabel={pending ? m.projects_creating() : m.projects_create()}
        pending={pending}
        onSubmit={async ({ name, date }) => {
          setPending(true);
          const exit = await create({
            payload: { name, date },
            reactivityKeys: projectsReactivity,
          });
          setPending(false);
          if (Exit.isSuccess(exit)) {
            setOpen(false);
            navigate({ to: "/projects/$projectId", params: { projectId: exit.value.id } });
          } else {
            toast.error(m.project_save_error());
          }
        }}
      />
    </>
  );
}

function ProjectsTable() {
  const result = useAtomValue(projectsListAtom);

  if (result._tag === "Initial") return <Loader />;
  if (result._tag === "Failure") {
    return <p className="text-sm text-red-500">{m.projects_load_error()}</p>;
  }
  if (result.value.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderKanban />
          </EmptyMedia>
          <EmptyTitle>{m.projects_empty_title()}</EmptyTitle>
          <EmptyDescription>{m.projects_description()}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto border">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b text-left text-xs">
          <tr>
            <th className="p-3 font-medium">{m.projects_column_name()}</th>
            <th className="hidden p-3 font-medium sm:table-cell">{m.projects_column_date()}</th>
            <th className="p-3 text-right font-medium">{m.projects_column_items()}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {result.value.map((project) => (
            <tr key={project.id} className="hover:bg-muted/50">
              <td className="p-3">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="font-medium hover:underline"
                >
                  {project.name}
                </Link>
              </td>
              <td className="text-muted-foreground hidden p-3 sm:table-cell">
                {project.date === null ? m.projects_no_date() : formatProjectDate(project.date)}
              </td>
              <td className="text-muted-foreground p-3 text-right">{project.itemCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
