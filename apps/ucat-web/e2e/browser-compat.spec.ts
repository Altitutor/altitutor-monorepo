import { expect, test } from "@playwright/test";
import { signInSeededStudent } from "./helpers/auth";

test("a student can use production-supported surfaces @critical @compat", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const serverFailures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverFailures.push(`${response.status()} ${response.url()}`);
    }
  });

  await signInSeededStudent(page);

  await page.goto("/practice");
  const startPractice = page.getByRole("button", { name: "Start practice" });
  for (
    let step = 0;
    step < 5 && !(await startPractice.isVisible());
    step += 1
  ) {
    await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(startPractice).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/subscribe");
  await expect(
    page.getByRole("heading", { name: "Choose your plan" }),
  ).toBeVisible({
    timeout: 30_000,
  });

  expect(serverFailures).toEqual([]);
});
