import { createAuth } from "@projection/auth";
import { type Database, createDb } from "@projection/db";

import { env } from "./env.server";

const db = createDb(env);

export function getDb(): Database {
  return db;
}
export const auth = createAuth(env, db);
