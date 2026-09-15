import { createFileRoute } from "@tanstack/react-router";
import { MonitorPlay } from "lucide-react";

import ComingSoon from "@/components/coming-soon";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/outputs")({
  component: () => (
    <ComingSoon title={m.nav_outputs()} description={m.outputs_description()} icon={MonitorPlay} />
  ),
});
