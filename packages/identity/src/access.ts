import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Rôles d'organisation, partagés entre le serveur better-auth et son client.
 * `operator` reprend les permissions du rôle `member` par défaut.
 */
export const ac = createAccessControl(defaultStatements);

export const roles = {
  owner: ac.newRole(ownerAc.statements),
  admin: ac.newRole(adminAc.statements),
  operator: ac.newRole(memberAc.statements),
};
