import type { Role } from "@projection/shared-kernel";

export const roleLabels: Record<Role, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  operator: "Opérateur",
};

export const assignableRoles = ["admin", "operator"] as const satisfies ReadonlyArray<Role>;

export const roleLabel = (role: string) => roleLabels[role as Role] ?? role;
