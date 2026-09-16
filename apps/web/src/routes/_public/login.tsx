import { createFileRoute, redirect } from "@tanstack/react-router";

import { authSearch, isInvitationRedirect } from "@/features/identity/auth-search";

/**
 * Ancienne adresse de connexion, conservée pour les liens déjà partagés : elle renvoie vers
 * la connexion, ou vers l'inscription pour un lien d'invitation.
 */
export const Route = createFileRoute("/_public/login")({
  validateSearch: authSearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: isInvitationRedirect(search.redirect) ? "/signup" : "/",
      search: { redirect: search.redirect },
    });
  },
});
