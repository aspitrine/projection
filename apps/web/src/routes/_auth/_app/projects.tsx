import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";

import ComingSoon from "@/components/coming-soon";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/projects")({
  component: () => (
    <ComingSoon
      title={m.nav_projects()}
      description={m.projects_description()}
      icon={FolderKanban}
    />
  ),
});
