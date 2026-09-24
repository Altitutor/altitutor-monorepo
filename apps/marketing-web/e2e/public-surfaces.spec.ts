import { expect, test } from "@playwright/test";

const publicSurfaces = [
  {
    path: "/ucat/",
    heading: /UCAT Prep\?.*Planned for you\./i,
  },
  {
    path: "/online-learning/",
    heading: /Altitutor Student Portal.*Moves with you\./i,
  },
] as const;

for (const surface of publicSurfaces) {
  test(`${surface.path} presents its primary customer promise @compat`, async ({
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

    const response = await page.goto(surface.path);

    expect(response?.ok(), `${surface.path} must return a successful response`).toBe(
      true,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: surface.heading }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(serverFailures).toEqual([]);
  });
}
