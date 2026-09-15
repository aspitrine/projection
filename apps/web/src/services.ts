import { createAuth } from "@projection/auth";

import { env } from "./env.server";

export const auth = createAuth(env);
