import { expect, test } from "@playwright/test";

import { signUpWithOrganization } from "./support";

const lyrics = [
  "[Couplet 1]",
  "Il est bon de louer le Seigneur",
  "Et de chanter le nom du Dieu le plus haut",
  "[Refrain]",
  "Alléluia, alléluia",
  "[Couplet 2]",
  "Tes bienfaits ne peuvent se compter",
  "[Refrain]",
].join("\n");

test.beforeEach(async ({ page }) => {
  await signUpWithOrganization(page);
});

test("créer, rechercher, modifier et supprimer un chant", async ({ page }) => {
  await page.goto("/library/songs");
  await expect(page.getByText("Aucun chant", { exact: true })).toBeVisible();

  // Création avec aperçu en direct
  // Le lien est présent dans l'en-tête et dans l'état vide.
  await page.getByRole("link", { name: "Nouveau chant" }).first().click();
  await expect(page).toHaveURL(/\/library\/songs\/new$/);
  await page.getByLabel("Titre").fill("Il est bon");
  await page.getByLabel("Auteurs").fill("Paul Wilbur");
  await page.getByLabel("Paroles").fill(lyrics);

  await expect(page.getByTestId("song-arrangement").getByRole("listitem")).toHaveText([
    "Couplet 1",
    "Refrain",
    "Couplet 2",
    "Refrain",
  ]);
  await expect(page.getByTestId("slide-preview")).toHaveCount(4);

  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Chant enregistré")).toBeVisible();
  await expect(page).toHaveURL(/\/library\/songs\/[0-9a-f-]{36}$/);

  // Liste et recherche
  await page.getByRole("link", { name: "Retour aux chants" }).click();
  const row = page.getByRole("row", { name: /Il est bon/ });
  await expect(row).toContainText("Paul Wilbur");

  const search = page.getByPlaceholder("Rechercher un titre…");
  await search.fill("gloire");
  await expect(page.getByText("Aucun chant ne correspond à « gloire »")).toBeVisible();
  await search.fill("BON");
  await expect(row).toBeVisible();

  // Modification, avec erreur de paroles bloquante
  await row.getByRole("link", { name: "Il est bon" }).click();
  await expect(page.getByLabel("Paroles")).toHaveValue(
    [
      "[Couplet 1]",
      "Il est bon de louer le Seigneur",
      "Et de chanter le nom du Dieu le plus haut",
      "",
      "[Refrain]",
      "Alléluia, alléluia",
      "",
      "[Couplet 2]",
      "Tes bienfaits ne peuvent se compter",
      "",
      "[Refrain]",
    ].join("\n"),
  );

  await page.getByLabel("Paroles").fill("[Couplet 1]\nLigne\n[Pont]");
  await expect(page.getByRole("alert")).toHaveText(
    "La balise « Pont » répète une section qui n'a pas encore de paroles.",
  );
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

  await page.getByLabel("Paroles").fill("[Refrain]\nGloire à son nom");
  await page.getByLabel("Titre").fill("Il est bon de louer");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Chant enregistré")).toBeVisible();

  await page.getByRole("link", { name: "Retour aux chants" }).click();
  await expect(page.getByRole("row", { name: /Il est bon de louer/ })).toBeVisible();

  // Suppression
  await page.getByRole("link", { name: "Il est bon de louer" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Chant supprimé")).toBeVisible();
  await expect(page).toHaveURL(/\/library\/songs$/);
  await expect(page.getByText("Aucun chant", { exact: true })).toBeVisible();
});

test("un chant inconnu affiche un message", async ({ page }) => {
  await page.goto("/library/songs/00000000-0000-4000-8000-000000000000");
  await expect(
    page.getByText("Ce chant n'existe pas ou n'appartient pas à votre organisation."),
  ).toBeVisible();
});
