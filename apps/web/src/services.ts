import { createAuth, migrateAuthSchema } from "@projection/identity/server";

import { env } from "./env.server";

export const auth = createAuth(env);

let authSchemaMigration: Promise<void> | undefined;

/** Migre les tables better-auth une seule fois ; réessaie à l'appel suivant en cas d'échec. */
export function ensureAuthSchema() {
  authSchemaMigration ??= migrateAuthSchema(auth).catch((error: unknown) => {
    authSchemaMigration = undefined;
    throw error;
  });
  return authSchemaMigration;
}
