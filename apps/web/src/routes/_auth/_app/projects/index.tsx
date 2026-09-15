import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@projection/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@projection/ui/components/empty";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { ClientOnly, Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Exit } from "effect";
import { FolderKanban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { createProjectAtom, projectsListAtom, projectsReactivity } from "@/features/projects/atoms";
import { formatProjectDate } from "@/features/projects/format";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/projects/")({
  component: () => (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">{m.nav_projects()}</h1>
      <ClientOnly fallback={<Loader />}>
        <NewProjectForm />
        <ProjectsTable />
      </ClientOnly>
    </div>
  ),
});

function NewProjectForm() {
  const navigate = useNavigate();
  const create = useAtomSet(createProjectAtom, { mode: "promiseExit" });
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-2 border p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (name.trim() === "") return;
        setPending(true);
        const exit = await create({
          payload: { name: name.trim(), date: date === "" ? null : date },
          reactivityKeys: projectsReactivity,
        });
        setPending(false);
        if (Exit.isSuccess(exit)) {
          navigate({ to: "/projects/$projectId", params: { projectId: exit.value.id } });
        } else {
          toast.error(m.project_save_error());
        }
      }}
    >
      <div className="min-w-56 flex-1 space-y-1">
        <Label htmlFor="project-name">{m.projects_name()}</Label>
        <Input
          id="project-name"
          required
          placeholder={m.projects_name_placeholder()}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="project-date">{m.projects_date()}</Label>
        <Input
          id="project-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending || name.trim() === ""}>
        {pending ? m.projects_creating() : m.projects_create()}
      </Button>
    </form>
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
