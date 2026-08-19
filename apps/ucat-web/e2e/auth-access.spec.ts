import { expect, test } from "@playwright/test";

test("an anonymous visitor is sent to login with return intent", async ({
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

test("a seeded completed student can reach the protected dashboard", async ({
  page,
}) => {
  await page.goto("/login?redirect=/dashboard");
  await page.getByLabel("Email address").fill("alice.williams@student.test");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL((url) => url.pathname === "/dashboard", {
    timeout: 20_000,
  });
  await expect(
    page.locator('[data-tour="dashboard-welcome-heading"]'),
  ).toContainText("Alice", { timeout: 30_000 });
});
