import { createFileRoute } from "@tanstack/react-router";

import { auth, ensureAuthSchema } from "../../../services";

async function handle({ request }: { request: Request }) {
  await ensureAuthSchema();
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
