import { createFileRoute } from "@tanstack/react-router";

import { apiHandler } from "@/server/api";

function handle({ request }: { request: Request }) {
  return apiHandler.handler(request);
}

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
