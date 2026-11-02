import { createRequire } from "node:module";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
// Use only an environment verified by dev:isolated exec; never select the normal shared stack.
const manifestPath = process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST;
if (!manifestPath)
  throw new Error("Run this benchmark through pnpm dev:isolated exec");
const proof = JSON.parse(readFileSync(manifestPath, "utf8"));
const config = readFileSync(
  path.join(proof.workdir, "supabase/config.toml"),
  "utf8",
);
const apiPort = config.match(/\[api\][\s\S]*?^port\s*=\s*(\d+)/m)?.[1];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const baseURL = process.env.ADMIN_E2E_BASE_URL;
if (
  proof.repository !== process.cwd() ||
  !proof.project_id.startsWith("altitutor-agent-test-") ||
  createHash("sha256").update(config).digest("hex") !== proof.config_sha256 ||
  !url ||
  new URL(url).hostname !== "127.0.0.1" ||
  new URL(url).port !== apiPort ||
  !baseURL ||
  !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
)
  throw new Error(
    "Expected the verified owned local DB and a local production preview",
  );
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const paragraphs = Number(process.env.BENCH_PARAGRAPHS || 80);
const taskCount = Number(process.env.BENCH_TASKS || 40);
if (
  !Number.isInteger(paragraphs) ||
  paragraphs < 1 ||
  paragraphs > 200 ||
  !Number.isInteger(taskCount) ||
  taskCount < 0 ||
  taskCount > 200
)
  throw new Error("Fixture sizes are outside the benchmark bounds");
const issueId = `27700000-0000-4000-8000-${String(paragraphs * 1000 + taskCount).padStart(12, "0")}`;
const name = `Resize baseline ${paragraphs} paragraphs ${taskCount} tasks`;
const text =
  "Review this operational request, coordinate the next steps with staff and the family, and retain the full history so that the next person can pick up the work. ".repeat(
    5,
  );
const description = {
  type: "doc",
  content: Array.from({ length: paragraphs }, (_, i) => ({
    type: "paragraph",
    content: [{ type: "text", text: `Fixture section ${i + 1}: ${text}` }],
  })),
};
const issue = await db
  .from("issues")
  .upsert({ id: issueId, name, description, status: "open" });
if (issue.error) throw issue.error;
const tasks = taskCount
  ? await db.from("tasks").upsert(
      Array.from({ length: taskCount }, (_, i) => ({
        id: `27700001-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        issue_id: issueId,
        title: `Resize linked task ${i + 1}`,
        status: "todo",
        priority: i % 5,
      })),
    )
  : { error: null };
if (tasks.error) throw tasks.error;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ADMIN_E2E_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.ADMIN_E2E_CHROMIUM_EXECUTABLE }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email", { exact: true }).fill("admin@altitutor.test");
  await page.getByPlaceholder("Enter your password").fill("test-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL(/\/dashboard\//, { timeout: 30000 });
  await page.goto(`${baseURL}/students`, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Expand accessory panel", exact: true })
    .click();
  const panel = page.getByRole("complementary", {
    name: "Accessory panel",
    exact: true,
  });
  await panel
    .getByRole("button", { name: "Add accessory tab", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("combobox").fill(name);
  await page
    .getByRole("dialog")
    .getByRole("option", { name: new RegExp(name) })
    .click();
  await panel
    .locator("p")
    .filter({ hasText: "Fixture section 1:" })
    .first()
    .waitFor({ state: "attached", timeout: 30000 });
  const divider = page.getByRole("separator", {
    name: "Resize accessory panel",
    exact: true,
  });
  await divider.waitFor({ state: "visible" });
  const box = await divider.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const data = {
      frames: [],
      inputs: [],
      tasks: [],
      running: true,
      last: performance.now(),
    };
    window.__resizeBench = data;
    const observer = new PerformanceObserver((list) =>
      data.tasks.push(...list.getEntries().map((x) => x.duration)),
    );
    observer.observe({ type: "longtask", buffered: false });
    data.observer = observer;
    data.input = (e) => {
      if (e.buttons === 1) data.inputs.push(performance.now() - e.timeStamp);
    };
    document.addEventListener("pointermove", data.input, true);
    const frame = (t) => {
      if (!data.running) return;
      data.frames.push(t - data.last);
      data.last = t;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const started = Date.now();
  for (let i = 0; i < 120; i++) {
    await page.mouse.move(
      box.x + box.width / 2 - 300 * Math.sin((i / 119) * Math.PI * 2),
      box.y + box.height / 2,
    );
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  const metrics = await page.evaluate(() => {
    const d = window.__resizeBench;
    d.running = false;
    d.observer.disconnect();
    document.removeEventListener("pointermove", d.input, true);
    const percentile = (xs, p) => {
      const a = xs.toSorted((a, b) => a - b);
      return a[Math.floor((a.length - 1) * p)] ?? 0;
    };
    return {
      frames: d.frames.length,
      inputEvents: d.inputs.length,
      frameP50: percentile(d.frames, 0.5),
      frameP95: percentile(d.frames, 0.95),
      frameMax: Math.max(...d.frames),
      inputP95: percentile(d.inputs, 0.95),
      longTasks: d.tasks.length,
      longTaskMax: Math.max(0, ...d.tasks),
      width: Number(
        document
          .querySelector('[aria-label="Resize accessory panel"]')
          .getAttribute("aria-valuenow"),
      ),
    };
  });
  console.log(
    JSON.stringify(
      {
        paragraphs,
        taskCount,
        cpuRate: 4,
        elapsedMs: Date.now() - started,
        ...metrics,
      },
      null,
      2,
    ),
  );
  if (metrics.inputEvents < 100)
    throw new Error("The real drag path was not exercised");
  if (metrics.frameP95 > 32 || metrics.inputP95 > 32 || metrics.frameMax > 80) {
    console.error(
      "RESIZE_BUDGET_FAIL: p95 frame/input exceeded 32ms or a frame exceeded 80ms",
    );
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
