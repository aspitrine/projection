import { Button } from "@projection/ui/components/button";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
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

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
      <aside className="bg-card hidden w-60 shrink-0 flex-col border-r md:flex">
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
