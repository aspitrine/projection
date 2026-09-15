import { type Page, expect } from "@playwright/test";

export const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export interface TestUser {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export const newUser = (): TestUser => {
  const suffix = uniqueSuffix();
  return {
    name: `Opérateur ${suffix}`,
    email: `e2e-${suffix}@projection.test`,
    password: "motdepasse-e2e",
  };
};

export async function signUp(page: Page, user: TestUser, path = "/login") {
  await page.goto(path);
  await page.getByLabel("Nom", { exact: true }).fill(user.name);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Mot de passe").fill(user.password);
  await page.getByRole("button", { name: "Créer le compte" }).click();
}

/** Nouveau compte + nouvelle organisation, arrive sur le tableau de bord. */
export async function signUpWithOrganization(page: Page) {
  const user = newUser();
  const organization = `Église E2E ${uniqueSuffix()}`;

  await signUp(page, user);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Nom de l'organisation").fill(organization);
  await page.getByRole("button", { name: "Créer l'organisation" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  return { user, organization };
}
