import { expect, test } from "@playwright/test";
import { signInSeededStudent } from "./helpers/auth";

const supportedRoutes = [
  "/dashboard",
  "/learn",
  "/practice",
  "/sets",
  "/mocks",
  "/sessions",
  "/skill-trainer",
  "/study-plan",
  "/progress",
  "/settings",
  "/settings/profile",
  "/settings/study-plan",
  "/settings/plan",
  "/subscribe",
] as const;

test("supported authenticated route families load without a server or browser failure", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await signInSeededStudent(page);

  for (const path of supportedRoutes) {
    await test.step(path, async () => {
      const response = await page.goto(path);
      expect(
        response?.status(),
        `${path} returned a server error`,
      ).toBeLessThan(500);
      await expect(page.locator("body")).not.toContainText(
        "Internal Server Error",
      );
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }

  expect(pageErrors).toEqual([]);
});
