import { Button } from "@projection/ui/components/button";
import { cn } from "@projection/ui/lib/utils";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useEffect, useState } from "react";

import OrganizationSwitcher from "@/components/organization-switcher";
import UserMenu from "@/components/user-menu";
import { m } from "@/paraglide/messages";

import { navigation } from "./navigation";

function Brand() {
  return (
    <Link to="/dashboard" className="flex h-12 shrink-0 items-center border-b px-4 font-semibold">
      {m.app_name()}
    </Link>
  );
}

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label={m.nav_main()} className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
      {navigation.map((group) => (
        <div key={group.id} className="space-y-1">
          {group.label && (
            <p className="text-muted-foreground px-2 pb-1 text-[0.7rem] font-medium tracking-wide uppercase">
              {group.label()}
            </p>
          )}
          {group.items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 px-2 py-1.5 text-sm transition-colors"
              activeProps={{ className: "bg-muted !text-foreground font-medium" }}
            >
              <Icon className="size-4" aria-hidden />
              {label()}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Clé du choix « menu ouvert / fermé » sur grand écran, propre au navigateur. */
const SIDEBAR_STORAGE_KEY = "projection:sidebar-open";

const readSidebarOpen = () => {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
};

const saveSidebarOpen = (open: boolean) => {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la session en cours.
  }
};

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  // Le rendu serveur ignore le choix enregistré : pas d'animation tant qu'il n'est pas relu.
  const [restored, setRestored] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setDesktopOpen(readSidebarOpen());
    // L'animation n'est activée qu'après l'application du choix : pas de fermeture animée au chargement.
    const frame = requestAnimationFrame(() => setRestored(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggleDesktop = () => {
    const next = !desktopOpen;
    setDesktopOpen(next);
    saveSidebarOpen(next);
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  return (
    <div className="flex h-svh">
      <aside
        className={cn(
          "bg-card hidden shrink-0 md:flex",
          restored && "transition-[width] duration-200",
          desktopOpen ? "w-60 flex-col border-r" : "w-0 overflow-hidden border-r-0",
        )}
        aria-hidden={!desktopOpen}
        inert={!desktopOpen}
      >
        <Brand />
        <SidebarNavigation />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label={m.nav_close_menu()}
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="mobile-navigation"
            className="bg-card relative flex h-full w-64 max-w-[80vw] flex-col border-r"
          >
            <Brand />
            <SidebarNavigation onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={mobileOpen ? m.nav_close_menu() : m.nav_open_menu()}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label={desktopOpen ? m.nav_close_menu() : m.nav_open_menu()}
            aria-expanded={desktopOpen}
            onClick={toggleDesktop}
          >
            {desktopOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </Button>
          <div className="flex-1" />
          <OrganizationSwitcher />
          <UserMenu />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
