import type { createAuth } from "@projection/auth";
import type { Database } from "@projection/db";

export type Context = {
  auth: null;
  session: Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>;
  db: Database;
};
