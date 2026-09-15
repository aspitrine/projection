import type { Role } from "@projection/shared-kernel";

import { m } from "@/paraglide/messages";

const roleMessages: Record<Role, () => string> = {
  owner: m.role_owner,
  admin: m.role_admin,
  operator: m.role_operator,
};

export const assignableRoles = ["admin", "operator"] as const satisfies ReadonlyArray<Role>;

export const roleLabel = (role: string) => roleMessages[role as Role]?.() ?? role;
