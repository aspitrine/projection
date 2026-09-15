import { expect, test } from "@playwright/test";

import { signUpWithOrganization } from "./support";

test("navigation principale entre les sections", async ({ page, isMobile }) => {
  await signUpWithOrganization(page);

  const openNavigation = async () => {
    if (isMobile) {
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    }
    return page.getByRole("navigation", { name: "Navigation principale" });
  };

  const sections = [
    { link: "Projets", url: /\/projects$/, heading: "Projets" },
    { link: "Bible", url: /\/library\/bible$/, heading: "Bible" },
    { link: "Chants", url: /\/library\/songs$/, heading: "Chants" },
    { link: "Membres", url: /\/settings\/members$/, heading: /Membres de/ },
  ];

  for (const section of sections) {
    const navigation = await openNavigation();
    await navigation.getByRole("link", { name: section.link }).click();
    await expect(page).toHaveURL(section.url);
    await expect(page.getByRole("heading", { level: 1, name: section.heading })).toBeVisible();
    if (isMobile) {
      await expect(page.getByRole("button", { name: "Fermer le menu" })).toHaveCount(0);
    }
  }
});

test("le menu mobile se ferme avec Échap", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Tiroir de navigation uniquement sur mobile");
  await signUpWithOrganization(page);

  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeHidden();
});
