import type { ProjectId } from "@projection/shared-kernel";
import { Atom } from "effect/unstable/reactivity";

import { ApiClient } from "@/api/client";

export const projectsReactivity = ["projects"] as const;

export const projectsListAtom = ApiClient.query("ProjectsList", undefined, {
  reactivityKeys: projectsReactivity,
});

export const projectAtom = Atom.family((id: ProjectId) =>
  ApiClient.query("ProjectsGet", { id }, { reactivityKeys: projectsReactivity }),
);

export const createProjectAtom = ApiClient.mutation("ProjectsCreate");
export const updateProjectAtom = ApiClient.mutation("ProjectsUpdate");
export const deleteProjectAtom = ApiClient.mutation("ProjectsDelete");
export const addItemAtom = ApiClient.mutation("ProjectsAddItem");
export const removeItemAtom = ApiClient.mutation("ProjectsRemoveItem");
export const moveItemAtom = ApiClient.mutation("ProjectsMoveItem");
