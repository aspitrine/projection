import { createFileRoute } from "@tanstack/react-router";
import { ImageIcon } from "lucide-react";

import ComingSoon from "@/components/coming-soon";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/library/media")({
  component: () => (
    <ComingSoon title={m.nav_media()} description={m.media_description()} icon={ImageIcon} />
  ),
});
