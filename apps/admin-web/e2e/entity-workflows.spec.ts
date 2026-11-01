import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email", { exact: true }).fill("admin@altitutor.test");
  await page.getByPlaceholder("Enter your password").fill("test-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\//, { timeout: 30_000 });
}

test("saved views use the expandable admin dialog and can be deleted persistently", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/tasks", { waitUntil: "domcontentloaded" });
  const name = `View browser check ${randomUUID().slice(0, 8)}`;
  await page.getByRole("button", { name: "New view", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "New view", exact: true });
  await dialog.getByLabel("View name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(dialog).toBeHidden();
  const views = page.getByLabel("Views", { exact: true });
  await views.getByRole("button", { name, exact: true }).dblclick();
  dialog = page.getByRole("dialog", { name: "Edit view", exact: true });
  await expect(
    dialog.getByRole("button", { name: "Full screen", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Full screen", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Exit full screen", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Delete view", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(views.getByRole("button", { name, exact: true })).toHaveCount(0);
  const persisted = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/quick_filters?") &&
      response.url().includes("eq.tasks") &&
      response.request().method() === "GET",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const response = await persisted;
  expect(response.ok()).toBe(true);
  expect(await response.json()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ name })]),
  );
  await expect(views.getByRole("button", { name, exact: true })).toHaveCount(0);
});

for (const [entity, route] of [
  ["Student", "/students/10000000-0000-0000-0000-000000000001"],
  ["Parent", "/parents/60000000-0000-0000-0000-000000000001"],
  ["Staff", "/staff/00000000-0000-0000-0000-000000000010"],
])
  test(`${entity} Sessions chooses table or calendar inside Display`, async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(route!, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("tab", { name: "Sessions", exact: true }).click();
    const main = page.locator("[data-admin-main]");
    await expect(
      page.getByRole("tab", { name: "Sessions", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      main.getByRole("button", { name: "Display options", exact: true }),
    ).toBeVisible();
    await expect(
      main.getByRole("tab", { name: "Calendar", exact: true }),
    ).toHaveCount(0);
    await main
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Display options", exact: true })
      .getByRole("button", { name: "Calendar", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[role="dialog"][aria-label="Display options"]'),
    ).toHaveCount(0);
    await expect(
      main.getByRole("button", { name: "Today", exact: true }),
    ).toBeVisible();
    await main
      .getByRole("button", { name: "Display options", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Display options", exact: true })
      .getByRole("button", { name: "Table", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[role="dialog"][aria-label="Display options"]'),
    ).toHaveCount(0);
    await expect(main.getByRole("table")).toBeVisible();
  });

function localDatabase(baseURL: string | undefined) {
  const url = process.env.ADMIN_E2E_SUPABASE_URL;
  const key = process.env.ADMIN_E2E_SERVICE_ROLE_KEY;
  if (
    !url ||
    !key ||
    !baseURL ||
    ![url, baseURL].every((value) =>
      ["localhost", "127.0.0.1"].includes(new URL(value).hostname),
    )
  )
    throw new Error("Fixtures require owned local servers");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test("mail actions form one segmented pill and retain tooltips", async ({
  page,
  baseURL,
}) => {
  await signIn(page);
  expect((await page.request.get("/api/email")).ok()).toBe(true);
  const db = localDatabase(baseURL);
  const id = `mail-browser-${randomUUID()}`;
  const occurredAt = new Date().toISOString();
  for (const result of [
    await db.from("email_folders").upsert({
      id: "browser-inbox",
      name: "Inbox",
      role: "inbox",
      present: true,
    }),
    await db.from("email_threads").insert({ id }),
    await db.from("email_messages").insert({
      id,
      thread_id: id,
      folder_id: "browser-inbox",
      occurred_at: occurredAt,
      data: {
        id,
        threadId: id,
        folderId: "browser-inbox",
        subject: "Segmented mail actions",
        bodyText: `A local browser fixture. ${id}`,
        sender: "family@example.test",
        to: ["admin@altitutor.test"],
        read: true,
        draft: false,
        receivedAt: occurredAt,
      },
    }),
  ])
    if (result.error) throw new Error(result.error.message);
  const search = await page.request.get(
    `/api/entity-references?type=email&search=${encodeURIComponent(id)}`,
  );
  expect(search.status()).toBe(200);
  expect(await search.json()).toEqual(
    expect.arrayContaining([expect.objectContaining({ type: "email", id })]),
  );
  await page.goto(`/email/${id}`);
  const article = page.getByRole("article", {
    name: "Email: Segmented mail actions",
    exact: true,
  });
  await article.hover();
  const group = article.getByRole("group", {
    name: "Email actions",
    exact: true,
  });
  await expect(group).toBeVisible();
  const styles = await group.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    buttons: [...element.querySelectorAll("button")].map((button) => ({
      background: getComputedStyle(button).backgroundColor,
      radius: getComputedStyle(button).borderTopLeftRadius,
    })),
  }));
  expect(styles.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.buttons.length).toBeGreaterThan(1);
  expect(
    styles.buttons.every(
      (button) =>
        button.background === "rgba(0, 0, 0, 0)" && button.radius === "0px",
    ),
  ).toBe(true);
  const read = group.getByRole("button", { name: "Reply", exact: true });
  await read.hover();
  await expect(page.getByRole("tooltip")).toContainText("Reply");
  await group.getByRole("button", { name: "Create task", exact: true }).click();
  const task = page.getByRole("dialog", { name: "Create Task", exact: true });
  await expect(
    task.locator(`[data-mention][data-type="email"][data-id="${id}"]`),
  ).toContainText("Segmented mail actions");
  const editor = task.locator('[contenteditable="true"]').first();
  await editor.click();
  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially(` @${id}`);
  await task
    .getByRole("button", {
      name: /Segmented mail actions.*family@example.test.*Emails/,
    })
    .click();
  await expect(
    task.locator(`[data-mention][data-type="email"][data-id="${id}"]`),
  ).toHaveCount(2);
  const title = `Email task ${randomUUID()}`;
  await task.getByPlaceholder("Task title").fill(title);
  await task.getByRole("button", { name: "Create Task", exact: true }).click();
  await expect(task).toBeHidden({ timeout: 15000 });
  const auth = await db.auth.signInWithPassword({
    email: "admin@altitutor.test",
    password: "test-password",
  });
  if (auth.error) throw new Error(auth.error.message);
  const saved = await db
    .from("tasks")
    .select("description")
    .eq("title", title)
    .single();
  expect(saved.error).toBeNull();
  expect(JSON.stringify(saved.data?.description)).toContain(id);
});

test("Student record offers contextual task creation without duplicate palette commands", async ({
  page,
  baseURL,
}) => {
  await signIn(page);
  await page.goto("/students/10000000-0000-0000-0000-000000000001");
  await page
    .getByRole("button", { name: "Record actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Add task", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create Task", exact: true });
  await expect(
    dialog.locator(
      '[data-mention][data-type="student"][data-id="10000000-0000-0000-0000-000000000001"]',
    ),
  ).toContainText("Alice Williams");
  const title = `Contextual task ${randomUUID()}`;
  await dialog.getByPlaceholder("Task title").fill(title);
  await dialog
    .getByRole("button", { name: "Create Task", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const db = localDatabase(baseURL);
  const auth = await db.auth.signInWithPassword({
    email: "admin@altitutor.test",
    password: "test-password",
  });
  if (auth.error) throw new Error(auth.error.message);
  const saved = await db
    .from("tasks")
    .select("description")
    .eq("title", title)
    .single();
  expect(saved.error).toBeNull();
  expect(JSON.stringify(saved.data?.description)).toContain(
    "10000000-0000-0000-0000-000000000001",
  );
  await page
    .getByRole("button", { name: "Open command palette", exact: true })
    .click();
  await page
    .getByRole("searchbox", {
      name: "Search commands and entities",
      exact: true,
    })
    .fill("Add task");
  const commands = page
    .getByRole("listbox", { name: "Search results", exact: true })
    .getByRole("option")
    .filter({ hasText: /Add task/i });
  await expect(commands).toHaveCount(1);
  await expect(commands).toContainText("Alice Williams");
  await commands.click();
  await expect(
    dialog.locator('[data-mention][data-type="student"]'),
  ).toContainText("Alice Williams");
});

test("entity reference details require an active admin and return only display fields", async ({
  page,
  request,
}) => {
  const path =
    "/api/entity-references/student/10000000-0000-0000-0000-000000000001";
  expect((await request.get(path)).status()).toBe(401);
  await signIn(page);
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  const details = await response.json();
  expect(details.title).toBe("Alice Williams");
  expect(details.fields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ label: "Year level" }),
      expect.objectContaining({ label: "Classes" }),
    ]),
  );
  expect(JSON.stringify(details)).not.toContain("invite_token");
});

test("rich-text record chips show a titled key-value hover card", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/students/10000000-0000-0000-0000-000000000001");
  await page
    .getByRole("button", { name: "Record actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Add task", exact: true }).click();
  const chip = page
    .getByRole("dialog", { name: "Create Task", exact: true })
    .locator('[data-mention][data-type="student"]')
    .first();
  await chip.hover();
  const preview = page.getByRole("dialog", {
    name: "Student preview",
    exact: true,
  });
  await expect(
    preview.getByRole("heading", { name: "Alice Williams", exact: true }),
  ).toBeVisible();
  await expect(preview).toContainText("Year level");
  await expect(preview).toContainText("Classes");
});

test("email and message references open the correct record and reveal the specific correspondence", async ({
  page,
  baseURL,
}) => {
  await signIn(page);
  expect((await page.request.get("/api/email")).ok()).toBe(true);
  const db = localDatabase(baseURL);
  const taskId = randomUUID(),
    conversationId = randomUUID(),
    contactId = randomUUID(),
    senderId = randomUUID();
  const threadId = `reference-thread-${randomUUID()}`,
    emailId = `reference-email-${randomUUID()}`;
  const messageId = randomUUID();
  const occurredAt = "2026-10-31T01:00:00Z";
  const results = [
    await db.from("email_threads").insert({ id: threadId }),
    await db.from("email_messages").insert({
      id: emailId,
      thread_id: threadId,
      occurred_at: occurredAt,
      data: {
        id: emailId,
        threadId,
        subject: "Exact email reference",
        bodyText: "The specific referenced email.",
        sender: "family@example.test",
        to: ["admin@altitutor.test"],
        read: true,
        draft: false,
        receivedAt: occurredAt,
      },
    }),
    await db.from("owned_numbers").insert({
      id: senderId,
      label: "Reference browser sender",
      phone_e164: `+614${String(Date.now()).slice(-8)}`,
      provider: "TWILIO",
      sender_type: "PHONE",
    }),
    await db.from("contacts").insert({
      id: contactId,
      contact_type: "OTHER",
      phone_e164: `+614${String(Date.now() + 1).slice(-8)}`,
    }),
    await db.from("conversations").insert({
      id: conversationId,
      contact_id: contactId,
      owned_number_id: senderId,
      status: "OPEN",
    }),
    await db.from("messages").insert(
      Array.from({ length: 55 }, (_, index) => ({
        id: index === 2 ? messageId : randomUUID(),
        conversation_id: conversationId,
        body:
          index === 2
            ? "The specific referenced message."
            : `Surrounding message ${index} ${"Conversation context. ".repeat(8)}`,
        direction: "INBOUND",
        status: "RECEIVED",
        from_number_e164: "+61427700001",
        to_number_e164: "+61427700002",
        created_at: new Date(
          Date.parse(occurredAt) + index * 60000,
        ).toISOString(),
      })),
    ),
    await db.from("tasks").insert({
      id: taskId,
      title: "Correspondence reference browser check",
      description: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "mention",
                attrs: {
                  type: "email",
                  id: emailId,
                  label: "Exact email reference",
                },
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "mention",
                attrs: {
                  type: "message",
                  id: messageId,
                  label: "Exact message reference",
                },
              },
            ],
          },
        ],
      },
    }),
  ];
  for (const result of results)
    if (result.error) throw new Error(result.error.message);
  await page.goto(`/tasks/${taskId}`);
  await expect(page).toHaveURL(/\/dashboard\//);
  await page.goto("/students/10000000-0000-0000-0000-000000000001");
  await page
    .locator(`[data-mention][data-type="email"][data-id="${emailId}"]`)
    .click();
  const panel = page.getByRole("complementary", {
    name: "Accessory panel",
    exact: true,
  });
  await expect(
    panel.getByRole("article", {
      name: "Email: Exact email reference",
      exact: true,
    }),
  ).toContainText("The specific referenced email.", { timeout: 30000 });
  await panel
    .getByRole("tab", {
      name: "Correspondence reference browser check",
      exact: true,
    })
    .click();
  await page
    .locator(`[data-mention][data-type="message"][data-id="${messageId}"]`)
    .click();
  const target = panel.locator(`[data-message-id="${messageId}"]`);
  await expect(target).toContainText("The specific referenced message.", {
    timeout: 30000,
  });
  await expect(target).toBeInViewport();
  await target.evaluate((element) => {
    let parent = element.parentElement;
    while (parent && getComputedStyle(parent).overflowY !== "auto")
      parent = parent.parentElement;
    if (!parent) throw new Error("Message scroll container missing");
    parent.scrollTop = parent.scrollHeight;
  });
  await expect(target).not.toBeInViewport();
  await panel
    .getByRole("tab", {
      name: "Correspondence reference browser check",
      exact: true,
    })
    .click();
  await page
    .locator(`[data-mention][data-type="message"][data-id="${messageId}"]`)
    .click();
  await expect(target).toBeInViewport();
  await target.hover();
  await target
    .getByRole("button", { name: "Create task", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Create Task", exact: true })
      .locator(`[data-mention][data-type="message"][data-id="${messageId}"]`),
  ).toContainText("The specific referenced message.");
  await expect(page).toHaveURL(
    /\/students\/10000000-0000-0000-0000-000000000001$/,
  );
});

test("accessory resizing preserves edits, responsive layout, keyboard bounds and settled width", async ({
  page,
  baseURL,
}) => {
  // Exercise both stacked and side-by-side states; the default 1280px viewport cannot fit the latter.
  await page.setViewportSize({ width: 1600, height: 1000 });
  const db = localDatabase(baseURL),
    id = randomUUID(),
    name = `Resize browser ${randomUUID().slice(0, 8)}`;
  const result = await db.from("issues").insert({
    id,
    name,
    description: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Issue content while resizing." }],
        },
      ],
    },
  });
  if (result.error) throw new Error(result.error.message);
  await signIn(page);
  await page.goto("/students");
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
  const title = panel.getByPlaceholder("Issue title");
  await title.fill(`${name} edited`);
  const divider = page.getByRole("separator", {
    name: "Resize accessory panel",
    exact: true,
  });
  const before = (await panel.boundingBox())!.width;
  const handle = (await divider.boundingBox())!;
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2 - 180,
    handle.y + handle.height / 2,
    { steps: 30 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => Math.round((await panel.boundingBox())!.width))
    .toBe(Math.round(before + 180));
  await expect(title).toHaveValue(`${name} edited`);
  await expect(panel.getByRole("status")).toHaveText("Saved");
  const settled = (await panel.boundingBox())!.width;
  await page.reload();
  const expand = page.getByRole("button", {
    name: "Expand accessory panel",
    exact: true,
  });
  if (await expand.isVisible()) await expand.click();
  await expect
    .poll(async () => Math.round((await panel.boundingBox())!.width))
    .toBe(Math.round(settled));
  await expect(title).toHaveValue(`${name} edited`);
  await divider.focus();
  await page.keyboard.press("Home");
  await expect
    .poll(async () => Math.round((await panel.boundingBox())!.width))
    .toBe(320);
  await expect(
    panel.getByRole("separator", {
      name: "Resize details sidebar",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.keyboard.press("End");
  await expect
    .poll(async () => Math.round((await panel.boundingBox())!.width))
    .toBe(Number(await divider.getAttribute("aria-valuemax")));
  await expect(
    panel.getByRole("separator", {
      name: "Resize details sidebar",
      exact: true,
    }),
  ).toBeVisible();
  await expect(title).toHaveValue(`${name} edited`);
});

test("reference previews cover people, scheduling and work-item projections", async ({
  page,
  baseURL,
}) => {
  const db = localDatabase(baseURL);
  const taskId = randomUUID(),
    issueId = randomUUID(),
    projectId = randomUUID();
  for (const result of [
    await db
      .from("tasks")
      .insert({ id: taskId, title: "Preview task", priority: 1 }),
    await db.from("issues").insert({ id: issueId, name: "Preview issue" }),
    await db
      .from("projects")
      .insert({ id: projectId, name: "Preview project", priority: 2 }),
    await db.from("project_members").insert({
      project_id: projectId,
      staff_id: "00000000-0000-0000-0000-000000000001",
    }),
  ])
    if (result.error) throw new Error(result.error.message);
  const classes = await db.from("classes").select("id").limit(1).single();
  const sessions = await db.from("sessions").select("id").limit(1).single();
  if (classes.error || sessions.error)
    throw new Error("Scheduling fixtures unavailable");
  await signIn(page);
  const cases: Array<[string, string, string[]]> = [
    ["parent", "60000000-0000-0000-0000-000000000001", ["Students"]],
    ["staff", "00000000-0000-0000-0000-000000000010", ["Role", "Classes"]],
    [
      "class",
      classes.data.id,
      ["Subject", "Scheduled offerings", "Students", "Staff"],
    ],
    [
      "session",
      sessions.data.id,
      ["Subject", "Day", "Time", "Students", "Staff"],
    ],
    ["task", taskId, ["Priority", "Assignee", "Due date"]],
    ["issue", issueId, ["Priority", "Due date"]],
    [
      "project",
      projectId,
      ["Priority", "Start date", "Target date", "Members"],
    ],
  ];
  for (const [type, id, labels] of cases) {
    const response = await page.request.get(
      `/api/entity-references/${type}/${id}`,
    );
    expect(response.status(), type).toBe(200);
    const details = await response.json();
    expect(details.title).toBeTruthy();
    expect(
      details.fields.map((field: { label: string }) => field.label),
    ).toEqual(labels);
    if (type === "task") expect(details.fields[0].value).toBe("Urgent");
    if (type === "project")
      expect(
        details.fields.find(
          (field: { label: string }) => field.label === "Members",
        ).value,
      ).toContain("Admin User");
  }
});

test("reference details and search refuse a signed-in account without active admin access", async ({
  page,
  baseURL,
}) => {
  const db = localDatabase(baseURL),
    email = `reference-access-${randomUUID()}@altitutor.test`;
  const user = await db.auth.admin.createUser({
    email,
    password: "test-password",
    email_confirm: true,
  });
  if (user.error) throw new Error(user.error.message);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByPlaceholder("Enter your password").fill("test-password");
  const authenticated = page.waitForResponse(
    (response) =>
      response.url().includes("/auth/v1/token") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  expect((await authenticated).ok()).toBe(true);
  await expect
    .poll(async () =>
      (
        await page.request.get(
          "/api/entity-references/student/10000000-0000-0000-0000-000000000001",
        )
      ).status(),
    )
    .toBe(403);
  expect(
    (
      await page.request.get(
        "/api/entity-references?type=message&search=message",
      )
    ).status(),
  ).toBe(403);
});

test("Add issue uses one main-record command and persists the contextual reference", async ({
  page,
  baseURL,
}) => {
  await signIn(page);
  await page.goto("/students/10000000-0000-0000-0000-000000000001");
  await page
    .getByRole("button", { name: "Open command palette", exact: true })
    .click();
  await page
    .getByRole("searchbox", {
      name: "Search commands and entities",
      exact: true,
    })
    .fill("Add issue");
  const commands = page
    .getByRole("listbox", { name: "Search results", exact: true })
    .getByRole("option")
    .filter({ hasText: /Add issue/i });
  await expect(commands).toHaveCount(1);
  await expect(commands).toContainText("Alice Williams");
  await commands.click();
  const dialog = page.getByRole("dialog", {
    name: "Create Issue",
    exact: true,
  });
  await expect(
    dialog.locator('[data-mention][data-type="student"]'),
  ).toContainText("Alice Williams");
  const title = `Contextual issue ${randomUUID()}`;
  await dialog.getByPlaceholder("Issue title").fill(title);
  await dialog
    .getByRole("button", { name: "Create Issue", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const db = localDatabase(baseURL);
  const auth = await db.auth.signInWithPassword({
    email: "admin@altitutor.test",
    password: "test-password",
  });
  if (auth.error) throw new Error(auth.error.message);
  const saved = await db
    .from("issues")
    .select("description")
    .eq("name", title)
    .single();
  expect(saved.error).toBeNull();
  expect(JSON.stringify(saved.data?.description)).toContain(
    "10000000-0000-0000-0000-000000000001",
  );
  await page
    .getByRole("button", { name: "Record actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Add issue", exact: true }).click();
  await expect(
    dialog.locator('[data-mention][data-type="student"]'),
  ).toContainText("Alice Williams");
});

test("Issues retain editable priority through create, autosave and hover previews", async ({
  page,
  baseURL,
}) => {
  await signIn(page);
  const db = localDatabase(baseURL);
  const auth = await db.auth.signInWithPassword({
    email: "admin@altitutor.test",
    password: "test-password",
  });
  if (auth.error) throw auth.error;
  const created = await db.rpc("admin_work_item_change", {
    p_kind: "issue",
    p_key: randomUUID(),
    p_changes: { name: `Priority browser check ${randomUUID()}`, priority: 1 },
  });
  expect(created.error).toBeNull();
  const record = (created.data as { record: { id: string; priority: number } })
    .record;
  expect(record.priority).toBe(1);
  await page.goto(`/issues/${record.id}`);
  await page.getByRole("button", { name: "Urgent", exact: true }).click();
  await page.getByRole("option", { name: "High", exact: true }).click();
  await expect
    .poll(async () => {
      const read = await db.rpc("admin_work_item_read", {
        p_kind: "issue",
        p_id: record.id,
      });
      if (read.error) throw read.error;
      return (read.data as { record: { priority: number } }).record.priority;
    })
    .toBe(2);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "High", exact: true }),
  ).toBeVisible();
  const preview = await page.request.get(
    `/api/entity-references/issue/${record.id}`,
  );
  expect(preview.ok()).toBe(true);
  expect((await preview.json()).fields).toContainEqual({
    label: "Priority",
    value: "High",
  });
  const invalid = await db.rpc("admin_work_item_patch", {
    p_kind: "issue",
    p_id: record.id,
    p_key: randomUUID(),
    p_changes: { priority: 5 },
    p_expected: { priority: 2 },
  });
  expect(invalid.error).not.toBeNull();

  await page
    .getByRole("button", { name: "Record actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Add issue", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Create Issue",
    exact: true,
  });
  await dialog
    .getByPlaceholder("Issue title")
    .fill(`Created with priority ${randomUUID()}`);
  await dialog
    .getByRole("button", { name: "No priority", exact: true })
    .click();
  await page.getByRole("option", { name: "Medium", exact: true }).click();
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/rpc/admin_work_item_change") &&
      response.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Create Issue", exact: true })
    .click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect((await response.json()).record.priority).toBe(3);
  await expect(dialog).toBeHidden();
});
