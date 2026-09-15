import { Button } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { assignableRoles, roleLabel } from "@/features/identity/roles";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/settings/members")({
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

const run = async (action: Promise<{ error: { message?: string } | null }>, success: string) => {
  const { error } = await action;
  if (error) {
    toast.error(error.message ?? m.members_action_error());
  } else {
    toast.success(success);
  }
};

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

  return (
    <div className="container mx-auto max-w-3xl space-y-8 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">
          {m.members_title({ organization: organization.name })}
        </h1>
        <p className="text-muted-foreground text-sm">
          {m.members_your_role({ role: currentMember ? roleLabel(currentMember.role) : "—" })}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-medium">{m.members_list()}</h2>
        <ul className="divide-y border" data-testid="members">
          {organization.members.map((member) => {
            const isSelf = member.id === currentMember?.id;
            const editable = canManage && !isSelf && member.role !== "owner";
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {member.user.name}
                    {isSelf ? ` ${m.members_you()}` : ""}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{member.user.email}</p>
                </div>
                {editable ? (
                  <select
                    aria-label={m.members_role_of({ name: member.user.name })}
                    className={selectClass}
                    value={member.role}
                    onChange={(event) =>
                      run(
                        authClient.organization.updateMemberRole({
                          memberId: member.id,
                          role: event.target.value as AssignableRole,
                        }),
                        m.members_role_updated(),
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
                        m.members_removed(),
                      )
                    }
                  >
                    {m.members_remove()}
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
            <h2 className="font-medium">{m.members_pending_title()}</h2>
            {pendingInvitations.length === 0 ? (
              <p className="text-muted-foreground text-sm">{m.members_pending_empty()}</p>
            ) : (
              <ul className="divide-y border" data-testid="invitations">
                {pendingInvitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
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
                          .then(() => toast.success(m.members_link_copied()))
                      }
                    >
                      {m.members_copy_link()}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        run(
                          authClient.organization.cancelInvitation({
                            invitationId: invitation.id,
                          }),
                          m.members_invitation_cancelled(),
                        )
                      }
                    >
                      {m.members_cancel_invitation()}
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
      <h2 className="font-medium">{m.members_invite_title()}</h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          const { data, error } = await authClient.organization.inviteMember({ email, role });
          setPending(false);
          if (error || !data) {
            toast.error(error?.message ?? m.members_invite_error());
            return;
          }
          setEmail("");
          setLink(invitationUrl(data.id));
        }}
      >
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="invite-email">{m.members_invite_email()}</Label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-role">{m.members_invite_role()}</Label>
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
          {m.members_invite_submit()}
        </Button>
      </form>
      {link && (
        <p className="text-sm" data-testid="invitation-link">
          {m.members_invite_link()} <code className="break-all">{link}</code>
        </p>
      )}
    </section>
  );
}
