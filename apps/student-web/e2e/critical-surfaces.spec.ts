import { expect, test, type Page } from "@playwright/test";

async function dismissOnboardingTour(page: Page) {
  const skipTour = page.getByRole("button", { name: "Skip tour" });
  const appeared = await skipTour
    .waitFor({ state: "visible", timeout: 1_000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;

  const completionFinished = page.waitForEvent("requestfinished", {
    predicate: (request) =>
      new URL(request.url()).pathname.endsWith(
        "/rest/v1/rpc/student_complete_onboarding_tour",
      ),
  });
  await skipTour.click();
  await expect(skipTour).toBeHidden();
  await completionFinished;
}

async function signIn(page: Page) {
  await page.goto("/login?next=/classes");
  await page.getByLabel("Email").fill("alice.williams@student.test");
  await page.getByPlaceholder("Enter your password").fill("test-password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/classes", {
    timeout: 20_000,
  });
  const welcome = page.getByRole("dialog", { name: /Welcome,/u });
  if (await welcome.isVisible()) {
    await welcome.getByRole("button", { name: "Continue" }).click();
    await welcome.getByRole("button", { name: "Finish" }).click();
    await expect(welcome).toBeHidden();
  }
}

test("a student can reach classes, resources, and billing @compat", async ({
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
  await page.route("**/functions/v1/payment-methods", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: {
        client_secret: "seti_e2e_secret_test",
        setup_intent_id: "seti_e2e",
      },
      status: 200,
    }),
  );

  await signIn(page);

  const surfaces = [
    ["/classes", "My Classes"],
    ["/resources", "Resources"],
    ["/billing", "Billing & Payments"],
  ] as const;
  for (const [path, heading] of surfaces) {
    await test.step(path, async () => {
      const billingPrewarmFinished =
        path === "/billing"
          ? page.waitForResponse((response) =>
              new URL(response.url()).pathname.endsWith(
                "/functions/v1/payment-methods",
              ),
            )
          : null;
      const response = await page.goto(path);
      expect(response?.ok(), `${path} must return a successful response`).toBe(
        true,
      );
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible({ timeout: 30_000 });
      if (billingPrewarmFinished) {
        expect((await billingPrewarmFinished).ok()).toBe(true);
      }
      await dismissOnboardingTour(page);
    });
  }

  await page.goto("/classes");
  await dismissOnboardingTour(page);
  await page.getByRole("button", { name: "Add to calendar" }).click();
  await expect(
    page.getByRole("heading", { name: "Add Altitutor timetable to calendar" }),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(serverFailures).toEqual([]);
});
