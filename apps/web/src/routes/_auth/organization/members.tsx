import { Button } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { assignableRoles, roleLabel } from "@/features/identity/roles";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth/organization/members")({
  component: () => (
    <ClientOnly fallback={<Loader />}>
      <MembersPage />
    </ClientOnly>
  ),
});

type AssignableRole = (typeof assignableRoles)[number];

const invitationUrl = (invitationId: string) =>
  new URL(`/invitations/${invitationId}`, window.location.origin).href;

const selectClass = "border-input bg-background h-8 rounded-none border px-2 text-xs";

function MembersPage() {
  const { data: organization, isPending } = authClient.useActiveOrganization();
  const { data: currentMember } = authClient.useActiveMember();

  if (isPending || !organization) {
    return <Loader />;
  }

  const canManage = currentMember?.role === "owner" || currentMember?.role === "admin";
  const pendingInvitations = organization.invitations.filter(
    (invitation) => invitation.status === "pending",
  );

  const run = async (action: Promise<{ error: { message?: string } | null }>, success: string) => {
    const { error } = await action;
    if (error) {
      toast.error(error.message ?? "Action impossible");
    } else {
      toast.success(success);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-8 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Membres de « {organization.name} »</h1>
        <p className="text-muted-foreground text-sm">
          Votre rôle : {currentMember ? roleLabel(currentMember.role) : "—"}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-medium">Membres</h2>
        <ul className="divide-y border" data-testid="members">
          {organization.members.map((member) => {
            const isSelf = member.id === currentMember?.id;
            const editable = canManage && !isSelf && member.role !== "owner";
            return (
              <li key={member.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {member.user.name}
                    {isSelf ? " (vous)" : ""}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{member.user.email}</p>
                </div>
                {editable ? (
                  <select
                    aria-label={`Rôle de ${member.user.name}`}
                    className={selectClass}
                    value={member.role}
                    onChange={(event) =>
                      run(
                        authClient.organization.updateMemberRole({
                          memberId: member.id,
                          role: event.target.value as AssignableRole,
                        }),
                        "Rôle mis à jour",
                      )
                    }
                  >
                    {assignableRoles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-muted-foreground text-xs">{roleLabel(member.role)}</span>
                )}
                {editable && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      run(
                        authClient.organization.removeMember({ memberIdOrEmail: member.id }),
                        "Membre retiré",
                      )
                    }
                  >
                    Retirer
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && (
        <>
          <InviteForm />
          <section className="space-y-2">
            <h2 className="font-medium">Invitations en attente</h2>
            {pendingInvitations.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune invitation en attente.</p>
            ) : (
              <ul className="divide-y border" data-testid="invitations">
                {pendingInvitations.map((invitation) => (
                  <li key={invitation.id} className="flex items-center gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{invitation.email}</p>
                      <p className="text-muted-foreground text-xs">{roleLabel(invitation.role)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(invitationUrl(invitation.id))
                          .then(() => toast.success("Lien copié"))
                      }
                    >
                      Copier le lien
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        run(
                          authClient.organization.cancelInvitation({
                            invitationId: invitation.id,
                          }),
                          "Invitation annulée",
                        )
                      }
                    >
                      Annuler
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("operator");
  const [link, setLink] = useState<string>();
  const [pending, setPending] = useState(false);

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Inviter un membre</h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          const { data, error } = await authClient.organization.inviteMember({ email, role });
          setPending(false);
          if (error || !data) {
            toast.error(error?.message ?? "Invitation impossible");
            return;
          }
          setEmail("");
          setLink(invitationUrl(data.id));
        }}
      >
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="invite-email">E-mail</Label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-role">Rôle</Label>
          <select
            id="invite-role"
            className={selectClass}
            value={role}
            onChange={(event) => setRole(event.target.value as AssignableRole)}
          >
            {assignableRoles.map((option) => (
              <option key={option} value={option}>
                {roleLabel(option)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          Inviter
        </Button>
      </form>
      {link && (
        <p className="text-sm" data-testid="invitation-link">
          Envoyez ce lien à la personne invitée : <code className="break-all">{link}</code>
        </p>
      )}
    </section>
  );
}
