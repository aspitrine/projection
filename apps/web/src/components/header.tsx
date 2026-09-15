import { Link } from "@tanstack/react-router";

import OrganizationSwitcher from "./organization-switcher";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Accueil" },
    { to: "/dashboard", label: "Tableau de bord" },
    { to: "/organization/members", label: "Membres" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} to={to}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <OrganizationSwitcher />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
