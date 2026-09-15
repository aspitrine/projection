import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { getUser } from "@/functions/get-user";

/** Pages accessibles sans organisation active. */
const withoutOrganization = ["/onboarding", "/invitations/"];

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    const session = await getUser();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    const allowed = withoutOrganization.some((path) => location.pathname.startsWith(path));
    if (!session.session.activeOrganizationId && !allowed) {
      throw redirect({ to: "/onboarding" });
    }
    return { session };
  },
});

function AuthLayout() {
  return <Outlet />;
}
