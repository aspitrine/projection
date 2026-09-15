import { Button } from "@projection/ui/components/button";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { roleLabel } from "@/features/identity/roles";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_setup/invitations/$invitationId")({
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
        <h1 className="mb-2 text-2xl font-semibold">{m.invitation_invalid_title()}</h1>
        <p className="text-muted-foreground text-sm">{m.invitation_invalid_description()}</p>
      </div>
    );
  }

  const accept = async () => {
    setPending(true);
    const { error } = await authClient.organization.acceptInvitation({ invitationId });
    if (error) {
      setPending(false);
      toast.error(error.message ?? m.invitation_accept_error());
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
      <h1 className="text-2xl font-semibold">
        {m.invitation_title({ organization: invitation.organizationName })}
      </h1>
      <p className="text-muted-foreground text-sm">
        {m.invitation_description({
          inviter: invitation.inviterEmail,
          role: roleLabel(invitation.role),
        })}
      </p>
      <div className="flex gap-2">
        <Button onClick={accept} disabled={pending}>
          {m.invitation_accept()}
        </Button>
        <Button variant="outline" onClick={reject} disabled={pending}>
          {m.invitation_reject()}
        </Button>
      </div>
    </div>
  );
}
