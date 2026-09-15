import type { Context as ApiContext } from "@projection/api/context";

import { getDb } from "./services";
import { auth } from "./services";

export async function createContext({ req }: { req: Request }): Promise<ApiContext> {
  const db = await getDb();
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return {
    db,
    auth: null,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
