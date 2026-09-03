import { expect, type Page } from "@playwright/test";

const seededStudent = {
  email: "alice.williams@student.test",
  password: "test-password",
};

export async function signInSeededStudent(page: Page, redirect = "/dashboard") {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible();
  await page.getByLabel("Email address").fill(seededStudent.email);
  await page.getByLabel("Password").fill(seededStudent.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((url) => url.pathname === redirect, {
    timeout: 20_000,
  });
}
