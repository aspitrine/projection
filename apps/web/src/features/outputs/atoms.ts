import { ApiClient } from "@/api/client";

export const outputsReactivity = ["outputs"] as const;

export const outputsListAtom = ApiClient.query("OutputsList", undefined, {
  reactivityKeys: outputsReactivity,
});

export const regenerateTokenAtom = ApiClient.mutation("OutputsRegenerateToken");
export const identifyOutputAtom = ApiClient.mutation("OutputsIdentify");
