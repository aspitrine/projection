import type { ProjectId } from "@projection/shared-kernel";
import { Atom } from "effect/unstable/reactivity";

import { ApiClient } from "@/api/client";

export const outputsReactivity = ["outputs"] as const;
export const splittingReactivity = ["outputs-splitting"] as const;

export const outputsListAtom = Atom.family((projectId: ProjectId) =>
  ApiClient.query("OutputsList", { projectId }, { reactivityKeys: outputsReactivity }),
);

export const splittingAtom = ApiClient.query("OutputsSplitting", undefined, {
  reactivityKeys: splittingReactivity,
});

export const createOutputAtom = ApiClient.mutation("OutputsCreate");
export const renameOutputAtom = ApiClient.mutation("OutputsRename");
export const removeOutputAtom = ApiClient.mutation("OutputsRemove");
export const regenerateTokenAtom = ApiClient.mutation("OutputsRegenerateToken");
export const identifyOutputAtom = ApiClient.mutation("OutputsIdentify");
export const updateSplittingAtom = ApiClient.mutation("OutputsUpdateSplitting");
export const setOutputThemeAtom = ApiClient.mutation("OutputsSetTheme");
