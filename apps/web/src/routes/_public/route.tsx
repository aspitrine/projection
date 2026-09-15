import { Outlet, createFileRoute } from "@tanstack/react-router";

import SiteHeader from "@/components/site-header";

export const Route = createFileRoute("/_public")({
  component: () => (
    <div className="grid min-h-svh grid-rows-[auto_1fr]">
      <SiteHeader />
      <Outlet />
    </div>
  ),
});
