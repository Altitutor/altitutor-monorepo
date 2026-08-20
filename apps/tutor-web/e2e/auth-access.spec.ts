import { expect, test } from "@playwright/test";

test("an anonymous visitor is sent to login with return intent", async ({
  page,
}) => {
  await page.goto("/classes?source=e2e");
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === "/login" &&
      url.searchParams.get("next") === "/classes?source=e2e"
    );
  });
});

test("a seeded active tutor can reach the protected dashboard", async ({
  page,
}) => {
  await page.goto("/login?next=/dashboard");
  await page.getByLabel("Email").fill("john.doe@altitutor.test");
  await page.getByPlaceholder("Enter your password").fill("test-password");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL((url) => url.pathname === "/dashboard", {
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: /Hi, John/ })).toBeVisible({
    timeout: 30_000,
  });
});
