import { Button } from "@projection/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@projection/ui/components/dropdown-menu";

import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

export default function OrganizationSwitcher() {
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();

  if (!organizations?.length) {
    return null;
  }

  // Rechargement complet : toutes les données affichées dépendent de l'organisation active.
  const switchTo = async (organizationId: string) => {
    await authClient.organization.setActive({ organizationId });
    window.location.assign("/dashboard");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="max-w-48" data-testid="organization-switcher" />
        }
      >
        <span className="truncate">{activeOrganization?.name ?? m.org_switcher_placeholder()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m.org_switcher_label()}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((organization) => (
            <DropdownMenuItem key={organization.id} onClick={() => switchTo(organization.id)}>
              {organization.id === activeOrganization?.id ? "✓ " : ""}
              {organization.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => window.location.assign("/onboarding")}>
            {m.org_switcher_new()}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
