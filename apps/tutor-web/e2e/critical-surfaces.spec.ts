import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/login?next=/classes");
  await page.getByLabel("Email").fill("john.doe@altitutor.test");
  await page.getByPlaceholder("Enter your password").fill("test-password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/classes", {
    timeout: 20_000,
  });
}

test("a tutor can reach teaching surfaces and begin a Tutor log", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const serverFailures: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverFailures.push(`${response.status()} ${response.url()}`);
    }
  });

  await signIn(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "My Classes" }),
  ).toBeVisible({ timeout: 30_000 });

  const resources = await page.goto("/resources");
  expect(resources?.ok(), "/resources must return a successful response").toBe(
    true,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Resources" }),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("/classes");
  await page.getByRole("button", { name: "Submit Tutor Log" }).click();
  await expect(page.getByRole("heading", { name: "Tutor log" })).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(serverFailures).toEqual([]);
});
