import { Outlet, createFileRoute } from "@tanstack/react-router";

import SiteHeader from "@/components/site-header";

/** Pages accessibles sans organisation active : création ou invitation. */
export const Route = createFileRoute("/_auth/_setup")({
  component: () => (
    <div className="grid min-h-svh grid-rows-[auto_1fr]">
      <SiteHeader />
      <Outlet />
    </div>
  ),
});
