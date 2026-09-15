import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import ComingSoon from "@/components/coming-soon";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/library/bible")({
  component: () => (
    <ComingSoon title={m.nav_bible()} description={m.bible_description()} icon={BookOpen} />
  ),
});
