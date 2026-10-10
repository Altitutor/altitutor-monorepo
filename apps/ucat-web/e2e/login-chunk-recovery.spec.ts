import { expect, test, type Page } from "@playwright/test";

const loginPath = "/login?redirect=%2Fsettings%2Fcommunications";

async function guardRequests(page: Page) {
  await page.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    return request.method() === "GET" &&
      ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue()
      : route.abort();
  });
}

async function expireChunkTimeout(page: Page) {
  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout.bind(window);
    const originalClearTimeout = window.clearTimeout.bind(window);
    const pending = new Map<number, () => void>();
    window.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      if (typeof handler !== "function") {
        return originalSetTimeout(handler, timeout, ...args);
      }
      const id = originalSetTimeout(() => {
        pending.delete(id);
        handler(...args);
      }, timeout);
      if (timeout === 120000) pending.set(id, () => handler(...args));
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = (id) => {
      if (typeof id === "number") pending.delete(id);
      originalClearTimeout(id);
    };
    Object.assign(window, {
      expireLoginChunkTimeout: () => {
        pending.forEach((handler, id) => {
          originalClearTimeout(id);
          handler();
        });
        pending.clear();
      },
    });
  });
}

async function triggerChunkTimeout(page: Page) {
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const browser = window as unknown as Window & {
      expireLoginChunkTimeout: () => void;
    };
    browser.expireLoginChunkTimeout();
  });
}

async function expectUsableLogin(page: Page) {
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible();
  await page.locator('input[type="email"]').fill("fixture@example.test");
  await expect(page.locator('input[type="email"]')).toHaveValue(
    "fixture@example.test",
  );
  await expect(page).toHaveURL(
    new RegExp("/login\\?redirect=%2Fsettings%2Fcommunications$"),
  );
}

test("@critical login recovers once when its error-boundary chunk fails transiently", async ({
  page,
}) => {
  await guardRequests(page);
  await expireChunkTimeout(page);
  let documents = 0;
  let blocked = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents++;
  });
  await page.route("**/_next/static/chunks/app/error-*.js", (route) => {
    blocked++;
    return blocked === 1 ? route.abort("timedout") : route.continue();
  });
  await page.goto(loginPath, { waitUntil: "domcontentloaded" });
  await triggerChunkTimeout(page);
  await expect.poll(() => documents).toBe(2);
  await expectUsableLogin(page);
  await expect(
    page.getByRole("button", { name: "Reload sign-in" }),
  ).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(documents).toBe(2);
});

test("@critical persistent chunk failure keeps an independent retry usable after hydration fallback", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await guardRequests(page);
  await expireChunkTimeout(page);
  let documents = 0;
  let blocked = true;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents++;
  });
  await page.route("**/_next/static/chunks/app/error-*.js", (route) =>
    blocked ? route.abort("timedout") : route.continue(),
  );
  await page.goto(loginPath, { waitUntil: "domcontentloaded" });
  await expect.poll(() => documents).toBe(2);
  await triggerChunkTimeout(page);
  await expect
    .poll(() => errors.some((error) => /ChunkLoadError/.test(error)))
    .toBe(true);
  await expect
    .poll(() => errors.some((error) => /Minified React error #423/.test(error)))
    .toBe(true);
  await expect(page.locator("form")).toHaveCount(0);
  const retry = page.getByRole("button", { name: "Reload sign-in" });
  await expect(retry).toBeVisible();
  await page.waitForTimeout(1000);
  expect(documents).toBe(2);
  await expect(retry).toBeFocused();
  blocked = false;
  await retry.click();
  await expectUsableLogin(page);
  expect(documents).toBe(3);
});

test("@critical bootstrap chunk failure has a retry even when React never hydrates", async ({
  page,
}) => {
  await guardRequests(page);
  await expireChunkTimeout(page);
  let documents = 0;
  let blocked = true;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents++;
  });
  await page.route("**/_next/static/chunks/main-app-*.js", (route) =>
    blocked ? route.abort("timedout") : route.continue(),
  );
  await page.goto(loginPath, { waitUntil: "domcontentloaded" });
  await expect.poll(() => documents).toBe(2);
  const retry = page.getByRole("button", { name: "Reload sign-in" });
  await expect(retry).toBeVisible();
  await expect(page.locator('form[data-hydrated="true"]')).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect(documents).toBe(2);
  blocked = false;
  await retry.click();
  await expectUsableLogin(page);
});

test("@critical blocked browser storage gives manual recovery without automatic reloads", async ({
  page,
}) => {
  await guardRequests(page);
  await expireChunkTimeout(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    });
  });
  let documents = 0;
  let blocked = true;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents++;
  });
  await page.route("**/_next/static/chunks/app/error-*.js", (route) =>
    blocked ? route.abort("timedout") : route.continue(),
  );
  await page.goto(loginPath, { waitUntil: "domcontentloaded" });
  await triggerChunkTimeout(page);
  const retry = page.getByRole("button", { name: "Reload sign-in" });
  await expect(retry).toBeVisible();
  await page.waitForTimeout(500);
  expect(documents).toBe(1);
  blocked = false;
  await retry.click();
  await expectUsableLogin(page);
  expect(documents).toBe(2);
});

test("@critical ordinary hydration errors never trigger chunk recovery", async ({
  page,
}) => {
  await guardRequests(page);
  let documents = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents++;
  });
  await page.goto(loginPath);
  await expectUsableLogin(page);
  await page.evaluate(() => {
    window.dispatchEvent(
      new ErrorEvent("error", { message: "Minified React error #418" }),
    );
  });
  await page.waitForTimeout(500);
  expect(documents).toBe(1);
  await expect(
    page.getByRole("button", { name: "Reload sign-in" }),
  ).toHaveCount(0);
});
