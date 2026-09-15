import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  DATABASE_URL: string;
};

export function createAuth(env: AuthConfig) {
  return betterAuth({
    database: new Pool({ connectionString: env.DATABASE_URL }),
    trustedOrigins: [env.BETTER_AUTH_URL],
    emailAndPassword: { enabled: true },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [tanstackStartCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** Crée ou met à jour les tables gérées par better-auth. */
export async function migrateAuthSchema(auth: Auth) {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}
