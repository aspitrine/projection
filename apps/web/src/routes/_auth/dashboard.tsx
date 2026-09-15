import { useAtomValue } from "@effect/atom-react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { ApiClient } from "@/api/client";
import { roleLabel } from "@/features/identity/roles";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

const whoAmIAtom = ApiClient.query("IdentityWhoAmI", undefined);

function RouteComponent() {
  const { session } = Route.useRouteContext();

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">Bonjour {session.user.name}</h1>
      <ClientOnly fallback={null}>
        <WhoAmI />
      </ClientOnly>
    </div>
  );
}

function WhoAmI() {
  const result = useAtomValue(whoAmIAtom);

  switch (result._tag) {
    case "Initial":
      return null;
    case "Failure":
      return <p className="text-red-500">Impossible d'identifier l'organisation active.</p>;
    case "Success":
      return (
        <p className="text-muted-foreground text-sm" data-testid="whoami">
          Rôle dans l'organisation active : {roleLabel(result.value.role)}
        </p>
      );
  }
}
