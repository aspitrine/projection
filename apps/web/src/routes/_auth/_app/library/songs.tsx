import { createFileRoute } from "@tanstack/react-router";
import { Music } from "lucide-react";

import ComingSoon from "@/components/coming-soon";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/library/songs")({
  component: () => (
    <ComingSoon title={m.nav_songs()} description={m.songs_description()} icon={Music} />
  ),
});
