import { expect, test } from "@playwright/test";

import { newUser, signUp, signUpWithOrganization } from "./support";

test("inscription, création d'organisation et tableau de bord", async ({ page }) => {
  const { user, organization } = await signUpWithOrganization(page);

  await expect(page.getByRole("heading", { name: `Bonjour ${user.name}` })).toBeVisible();
  await expect(page.getByTestId("whoami")).toHaveText(
    "Rôle dans l'organisation active : Propriétaire",
  );
  await expect(page.getByTestId("organization-switcher")).toContainText(organization);
});

test("une page de l'application sans session redirige vers la connexion", async ({ page }) => {
  await page.goto("/library/songs");
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByRole("heading", { name: "Créer un compte" })).toBeVisible();
});

test("invitation d'un opérateur par lien", async ({ page, browser }) => {
  const { organization } = await signUpWithOrganization(page);
  const invitee = newUser();

  await page.goto("/settings/members");
  await page.getByLabel("E-mail").fill(invitee.email);
  await page.getByRole("button", { name: "Inviter" }).click();
  const link = await page.getByTestId("invitation-link").locator("code").textContent();
  expect(link).toMatch(/\/invitations\//);
  await expect(page.getByTestId("invitations")).toContainText(invitee.email);

  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();
  await inviteePage.goto(link ?? "");
  await expect(inviteePage).toHaveURL(/\/login\?redirect=/);
  await signUp(inviteePage, invitee, inviteePage.url());

  await expect(
    inviteePage.getByRole("heading", { name: `Rejoindre « ${organization} »` }),
  ).toBeVisible();
  await inviteePage.getByRole("button", { name: "Accepter" }).click();
  await expect(inviteePage).toHaveURL(/\/dashboard$/);
  await expect(inviteePage.getByTestId("whoami")).toHaveText(
    "Rôle dans l'organisation active : Opérateur",
  );

  // Un opérateur ne voit pas les outils de gestion des membres.
  await inviteePage.goto("/settings/members");
  await expect(inviteePage.getByTestId("members")).toContainText(`${invitee.name} (vous)`);
  await expect(inviteePage.getByRole("button", { name: "Inviter" })).toHaveCount(0);
  await inviteeContext.close();

  await page.reload();
  await expect(page.getByTestId("members")).toContainText(invitee.email);
});
