import { Link } from "@tanstack/react-router";

import { m } from "@/paraglide/messages";

import UserMenu from "./user-menu";

export default function SiteHeader() {
  return (
    <header className="flex h-12 items-center justify-between border-b px-4">
      <Link to="/" className="font-semibold">
        {m.app_name()}
      </Link>
      <UserMenu />
    </header>
  );
}
