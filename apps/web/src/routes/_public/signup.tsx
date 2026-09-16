import { createFileRoute, redirect } from "@tanstack/react-router";

import SignUpForm from "@/components/sign-up-form";
import { authSearch } from "@/features/identity/auth-search";
import { getUser } from "@/functions/get-user";
import { safeRedirect } from "@/lib/safe-redirect";

export const Route = createFileRoute("/_public/signup")({
  validateSearch: authSearch,
  beforeLoad: async ({ search }) => {
    if (await getUser()) {
      throw redirect({ href: safeRedirect(search.redirect) ?? "/dashboard" });
    }
  },
  component: SignUpPage,
});

function SignUpPage() {
  const { redirect: target } = Route.useSearch();
  return <SignUpForm redirectTo={safeRedirect(target)} />;
}
