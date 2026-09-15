import { useAtomValue } from "@effect/atom-react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { ApiClient } from "@/api/client";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const healthAtom = ApiClient.query("SystemHealth", undefined);

function HomeComponent() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-3xl font-semibold">Projection</h1>
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-medium">État de l'API</h2>
        <ClientOnly fallback={<ApiStatusView tone="pending" label="Vérification…" />}>
          <ApiStatus />
        </ClientOnly>
      </section>
    </div>
  );
}

function ApiStatus() {
  const result = useAtomValue(healthAtom);

  switch (result._tag) {
    case "Initial":
      return <ApiStatusView tone="pending" label="Vérification…" />;
    case "Failure":
      return <ApiStatusView tone="down" label="API injoignable" />;
    case "Success":
      return result.value.database === "up" ? (
        <ApiStatusView tone="up" label="Connecté" />
      ) : (
        <ApiStatusView tone="down" label="Base de données injoignable" />
      );
  }
}

const toneClass = {
  pending: "bg-yellow-500",
  up: "bg-green-500",
  down: "bg-red-500",
} as const;

function ApiStatusView({ tone, label }: { tone: keyof typeof toneClass; label: string }) {
  return (
    <div className="flex items-center gap-2" data-testid="api-status">
      <div className={`h-2 w-2 rounded-full ${toneClass[tone]}`} />
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}
