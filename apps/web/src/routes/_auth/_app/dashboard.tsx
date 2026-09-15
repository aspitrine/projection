import { useAtomValue } from "@effect/atom-react";
import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";
import { FolderKanban, Music, Users } from "lucide-react";

import { ApiClient } from "@/api/client";
import { roleLabel } from "@/features/identity/roles";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/dashboard")({
  component: RouteComponent,
});

const whoAmIAtom = ApiClient.query("IdentityWhoAmI", undefined);

function RouteComponent() {
  const { session } = Route.useRouteContext();

  const steps = [
    { to: "/library/songs", label: m.dashboard_step_songs(), icon: Music },
    { to: "/projects", label: m.dashboard_step_project(), icon: FolderKanban },
    { to: "/settings/members", label: m.dashboard_step_members(), icon: Users },
  ] as const;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {m.dashboard_greeting({ name: session.user.name })}
        </h1>
        <ClientOnly fallback={null}>
          <WhoAmI />
        </ClientOnly>
      </div>
      <section className="space-y-2">
        <h2 className="font-medium">{m.dashboard_next_steps()}</h2>
        <ul className="divide-y border">
          {steps.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="hover:bg-muted flex items-center gap-3 p-3 text-sm">
                <Icon className="text-muted-foreground size-4" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function WhoAmI() {
  const result = useAtomValue(whoAmIAtom);

  switch (result._tag) {
    case "Initial":
      return null;
    case "Failure":
      return <p className="text-red-500">{m.dashboard_actor_error()}</p>;
    case "Success":
      return (
        <p className="text-muted-foreground text-sm" data-testid="whoami">
          {m.dashboard_role({ role: roleLabel(result.value.role) })}
        </p>
      );
  }
}
