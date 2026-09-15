import { Actor } from "@projection/shared-kernel";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Effect, Layer, Schema } from "effect";
import { Pool } from "pg";

import { ac, roles } from "../access";
import { Authentication } from "../application/Authentication";
import { NoActiveOrganization, Unauthenticated } from "../domain/errors";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  DATABASE_URL: string;
};

export function createAuth(env: AuthConfig) {
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  return betterAuth({
    database: pool,
    trustedOrigins: [env.BETTER_AUTH_URL],
    emailAndPassword: { enabled: true },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    databaseHooks: {
      session: {
        create: {
          // Une nouvelle session reprend la première organisation de l'utilisateur.
          before: async (session) => {
            const { rows } = await pool.query<{ organizationId: string }>(
              'SELECT "organizationId" FROM "member" WHERE "userId" = $1 ORDER BY "createdAt" LIMIT 1',
              [session.userId],
            );
            return {
              data: { ...session, activeOrganizationId: rows[0]?.organizationId ?? null },
            };
          },
        },
      },
    },
    plugins: [
      organization({
        ac,
        roles,
        creatorRole: "owner",
        // Pas encore d'envoi d'e-mail : le lien est affiché dans l'interface et journalisé.
        sendInvitationEmail: async ({ id, email, organization }) => {
          console.info(
            `[identity] invitation de ${email} dans « ${organization.name} » : ${env.BETTER_AUTH_URL}/invitations/${id}`,
          );
        },
      }),
      // Doit rester le dernier plugin.
      tanstackStartCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** Crée ou met à jour les tables gérées par better-auth. */
export async function migrateAuthSchema(auth: Auth) {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}

const decodeActor = Schema.decodeUnknownEffect(Actor);

export const layerAuthentication = (auth: Auth) =>
  Layer.succeed(
    Authentication,
    Authentication.of({
      resolveActor: Effect.fn("Authentication.resolveActor")(function* (headers) {
        const requestHeaders = new globalThis.Headers(Object.entries(headers));

        const session = yield* Effect.tryPromise(() =>
          auth.api.getSession({ headers: requestHeaders }),
        ).pipe(Effect.orDie);
        if (!session) {
          return yield* new Unauthenticated();
        }
        if (!session.session.activeOrganizationId) {
          return yield* new NoActiveOrganization();
        }

        const member = yield* Effect.tryPromise(() =>
          auth.api.getActiveMember({ headers: requestHeaders }),
        ).pipe(Effect.orDie);
        if (!member) {
          return yield* new NoActiveOrganization();
        }

        return yield* decodeActor({
          userId: session.user.id,
          organizationId: member.organizationId,
          role: member.role.split(",")[0],
        }).pipe(Effect.orDie);
      }),
    }),
  );
