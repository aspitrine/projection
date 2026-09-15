import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { safeRedirect } from "@/lib/safe-redirect";

export const Route = createFileRoute("/_public/login")({
  validateSearch: Schema.toStandardSchemaV1(
    Schema.Struct({ redirect: Schema.optional(Schema.String) }),
  ),
  component: RouteComponent,
});

function RouteComponent() {
  const { redirect } = Route.useSearch();
  const redirectTo = safeRedirect(redirect);
  // Un lien d'invitation mène généralement à un nouveau compte.
  const [showSignIn, setShowSignIn] = useState(false);

  return showSignIn ? (
    <SignInForm redirectTo={redirectTo} onSwitchToSignUp={() => setShowSignIn(false)} />
  ) : (
    <SignUpForm redirectTo={redirectTo} onSwitchToSignIn={() => setShowSignIn(true)} />
  );
}
