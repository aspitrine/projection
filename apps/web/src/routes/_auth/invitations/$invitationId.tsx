import { Button } from "@projection/ui/components/button";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { roleLabel } from "@/features/identity/roles";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth/invitations/$invitationId")({
  component: () => (
    <ClientOnly fallback={<Loader />}>
      <InvitationPage />
    </ClientOnly>
  ),
});

type Invitation = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.getInvitation>>["data"]
>;

function InvitationPage() {
  const { invitationId } = Route.useParams();
  const [invitation, setInvitation] = useState<Invitation | null>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    authClient.organization
      .getInvitation({ query: { id: invitationId } })
      .then(({ data }) => setInvitation(data ?? null));
  }, [invitationId]);

  if (invitation === undefined) {
    return <Loader />;
  }

  if (invitation === null || invitation.status !== "pending") {
    return (
      <div className="mx-auto mt-10 max-w-md p-6">
        <h1 className="mb-2 text-2xl font-semibold">Invitation invalide</h1>
        <p className="text-muted-foreground text-sm">
          Ce lien a expiré, a déjà été utilisé ou ne correspond pas à votre adresse e-mail.
        </p>
      </div>
    );
  }

  const accept = async () => {
    setPending(true);
    const { error } = await authClient.organization.acceptInvitation({ invitationId });
    if (error) {
      setPending(false);
      toast.error(error.message ?? "Impossible d'accepter l'invitation");
      return;
    }
    await authClient.organization.setActive({ organizationId: invitation.organizationId });
    window.location.assign("/dashboard");
  };

  const reject = async () => {
    setPending(true);
    await authClient.organization.rejectInvitation({ invitationId });
    window.location.assign("/dashboard");
  };

  return (
    <div className="mx-auto mt-10 max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Rejoindre « {invitation.organizationName} »</h1>
      <p className="text-muted-foreground text-sm">
        {invitation.inviterEmail} vous invite en tant que{" "}
        <strong>{roleLabel(invitation.role)}</strong>.
      </p>
      <div className="flex gap-2">
        <Button onClick={accept} disabled={pending}>
          Accepter
        </Button>
        <Button variant="outline" onClick={reject} disabled={pending}>
          Refuser
        </Button>
      </div>
    </div>
  );
}
