import {
  BookOpen,
  FolderKanban,
  ImageIcon,
  LayoutDashboard,
  type LucideIcon,
  MonitorPlay,
  Music,
  Presentation,
  Users,
} from "lucide-react";

import { m } from "@/paraglide/messages";

export interface NavigationItem {
  readonly to:
    | "/dashboard"
    | "/projects"
    | "/library/songs"
    | "/library/bible"
    | "/library/slides"
    | "/library/media"
    | "/outputs"
    | "/settings/members";
  readonly label: () => string;
  readonly icon: LucideIcon;
}

export interface NavigationGroup {
  readonly id: string;
  readonly label?: () => string;
  readonly items: ReadonlyArray<NavigationItem>;
}

export const navigation: ReadonlyArray<NavigationGroup> = [
  {
    id: "main",
    items: [
      { to: "/dashboard", label: m.nav_dashboard, icon: LayoutDashboard },
      { to: "/projects", label: m.nav_projects, icon: FolderKanban },
    ],
  },
  {
    id: "library",
    label: m.nav_library,
    items: [
      { to: "/library/songs", label: m.nav_songs, icon: Music },
      { to: "/library/bible", label: m.nav_bible, icon: BookOpen },
      { to: "/library/slides", label: m.nav_slides, icon: Presentation },
      { to: "/library/media", label: m.nav_media, icon: ImageIcon },
    ],
  },
  {
    id: "broadcast",
    items: [{ to: "/outputs", label: m.nav_outputs, icon: MonitorPlay }],
  },
  {
    id: "settings",
    label: m.nav_settings,
    items: [{ to: "/settings/members", label: m.nav_members, icon: Users }],
  },
];
