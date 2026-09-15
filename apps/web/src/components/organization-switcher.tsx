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
        render={<Button variant="outline" data-testid="organization-switcher" />}
      >
        {activeOrganization?.name ?? "Choisir une organisation"}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organisations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((organization) => (
            <DropdownMenuItem key={organization.id} onClick={() => switchTo(organization.id)}>
              {organization.id === activeOrganization?.id ? "✓ " : ""}
              {organization.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => window.location.assign("/onboarding")}>
            Nouvelle organisation
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
