import { createFileRoute, redirect } from "@tanstack/react-router";

import AppShell from "@/components/app-shell/app-shell";

/** Application : nécessite une organisation active. */
export const Route = createFileRoute("/_auth/_app")({
  beforeLoad: ({ context }) => {
    if (!context.session.session.activeOrganizationId) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: AppShell,
});
