import { useAtomValue } from "@effect/atom-react";
import { buttonVariants } from "@projection/ui/components/button";
import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";

import { ApiClient } from "@/api/client";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/")({
  component: HomeComponent,
});

const healthAtom = ApiClient.query("SystemHealth", undefined);

function HomeComponent() {
  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">{m.app_name()}</h1>
        <p className="text-muted-foreground">{m.home_tagline()}</p>
        <Link to="/dashboard" className={buttonVariants()}>
          {m.home_open_app()}
        </Link>
      </div>
      <section className="border p-4">
        <h2 className="mb-2 font-medium">{m.home_api_status()}</h2>
        <ClientOnly fallback={<ApiStatusView tone="pending" label={m.home_api_checking()} />}>
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
      return <ApiStatusView tone="pending" label={m.home_api_checking()} />;
    case "Failure":
      return <ApiStatusView tone="down" label={m.home_api_down()} />;
    case "Success":
      return result.value.database === "up" ? (
        <ApiStatusView tone="up" label={m.home_api_connected()} />
      ) : (
        <ApiStatusView tone="down" label={m.home_database_down()} />
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
