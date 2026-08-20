import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByPlaceholder("Enter your password").fill("test-password");
  await page.getByRole("button", { name: "Sign In" }).click();
}

test.describe("student access", () => {
  test("redirects an anonymous protected request with return intent", async ({
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

  test("allows a seeded student to load the dashboard", async ({ page }) => {
    await signIn(page, "alice.williams@student.test");

    await expect(page).toHaveURL((url) => url.pathname === "/dashboard", {
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: /Hi, Alice/ })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("redirects a seeded tutor away from student-web", async ({ page }) => {
    await page.route("http://localhost:3002/**", async (route) => {
      await route.fulfill({ status: 200, body: "Tutor portal" });
    });

    await signIn(page, "john.doe@altitutor.test");

    await expect(page).toHaveURL(
      (url) => url.origin === "http://localhost:3002",
    );
  });

  test("redirects a seeded admin away from student-web", async ({ page }) => {
    await page.route("http://localhost:3000/**", async (route) => {
      await route.fulfill({ status: 200, body: "Admin portal" });
    });

    await signIn(page, "admin@altitutor.test");

    await expect(page).toHaveURL(
      (url) => url.origin === "http://localhost:3000",
    );
  });
});
