import { authClient } from "@/lib/auth-client";

/** Seuls propriétaires et administrateurs modifient sorties, thèmes et découpage. */
export function useCanManage() {
  const { data: member } = authClient.useActiveMember();
  return member?.role === "owner" || member?.role === "admin";
}
