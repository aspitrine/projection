import { createFileRoute } from "@tanstack/react-router";

import { apiHandler } from "@/server/api";

/**
 * Les abonnements (`LiveWatch`, `DisplayWatch`) gardent une réponse HTTP ouverte et
 * envoient une ligne NDJSON à chaque changement. Un reverse proxy qui met la réponse
 * en tampon (nginx : `proxy_buffering on` par défaut) retiendrait ces lignes et
 * l'écran ne bougerait qu'au bout de plusieurs secondes, voire pas du tout.
 *
 * `X-Accel-Buffering: no` désactive ce tampon côté nginx, `no-transform` demande aux
 * intermédiaires de ne pas réencoder la réponse. Voir [docs/deploiement.md].
 */
const streamingHeaders = {
  "Cache-Control": "no-cache, no-store, no-transform",
  "X-Accel-Buffering": "no",
} as const;

async function handle({ request }: { request: Request }) {
  const response = await apiHandler.handler(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(streamingHeaders)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
