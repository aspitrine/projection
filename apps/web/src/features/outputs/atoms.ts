import { ApiClient } from "@/api/client";

export const outputsReactivity = ["outputs"] as const;
export const splittingReactivity = ["outputs-splitting"] as const;

export const outputsListAtom = ApiClient.query("OutputsList", undefined, {
  reactivityKeys: outputsReactivity,
});

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
