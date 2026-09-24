import { expect, test } from "@playwright/test";
import { signInSeededStudent } from "./helpers/auth";

test("an anonymous visitor is sent to login with return intent @critical @compat", async ({
  page,
}) => {
  await page.goto("/dashboard?source=e2e");

  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === "/login" &&
      url.searchParams.get("redirect") === "/dashboard?source=e2e"
    );
  });
});

test("a seeded completed student can reach the protected dashboard @critical @compat", async ({
  page,
}) => {
  await signInSeededStudent(page);
  await expect(
    page.locator('[data-tour="dashboard-welcome-heading"]'),
  ).toContainText("Alice", { timeout: 30_000 });
});
