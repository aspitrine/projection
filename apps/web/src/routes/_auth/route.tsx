import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { isInvitationRedirect } from "@/features/identity/auth-search";
import { getUser } from "@/functions/get-user";

export const Route = createFileRoute("/_auth")({
  component: Outlet,
  beforeLoad: async ({ location }) => {
    const session = await getUser();
    if (!session) {
      throw redirect({
        to: isInvitationRedirect(location.href) ? "/signup" : "/",
        search: { redirect: location.href },
      });
    }
    return { session };
  },
});
