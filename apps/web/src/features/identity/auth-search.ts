import { Schema } from "effect";

import { safeRedirect } from "@/lib/safe-redirect";

/** Paramètre `redirect` des pages de connexion et d'inscription. */
export const authSearch = Schema.toStandardSchemaV1(
  Schema.Struct({ redirect: Schema.optional(Schema.String) }),
);

/** Un lien d'invitation mène généralement à un compte qui n'existe pas encore. */
export const isInvitationRedirect = (redirect: string | undefined) =>
  safeRedirect(redirect)?.startsWith("/invitations/") ?? false;
