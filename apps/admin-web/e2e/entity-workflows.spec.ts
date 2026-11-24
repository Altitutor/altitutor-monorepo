import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email", { exact: true }).fill("admin@altitutor.test");
  await page.getByPlaceholder("Enter your password").fill("test-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 });
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
  const searchId = `mail-browser-${randomUUID()}`;
  const id = `${searchId}+/=`;
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
  await page.goto(`/email/${encodeURIComponent(id)}`);
  const threadActions = page.getByRole("group", { name: "Conversation actions", exact: true });
  await expect(threadActions.getByRole("button", { name: "Search", exact: true })).toBeVisible();
  await expect(threadActions.getByRole("button", { name: "More", exact: true })).toBeVisible();
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
  const reply = group.getByRole("button", { name: "Reply", exact: true });
  await reply.hover();
  await expect(page.getByRole("tooltip")).toContainText("Reply");
  await expect(group.getByRole("button", { name: "Reply all", exact: true })).toBeVisible();
  await expect(group.getByRole("button", { name: "Forward", exact: true })).toBeVisible();
  await expect(group.getByRole("button", { name: "More", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await group.getByRole("button", { name: "Create task", exact: true }).click();
  const task = page.getByRole("dialog", { name: "Create Task", exact: true });
  await expect(
    task.locator(`[data-mention][data-type="email"][data-id="${id}"]`),
  ).toContainText("Segmented mail actions");
  const title = `Email task ${randomUUID()}`;
  const taskTitle = task.getByPlaceholder("Task title");
  await expect(taskTitle).toBeFocused();
  await taskTitle.fill(title);
  const editor = task.locator('[contenteditable="true"]').first();
  await editor.click();
  await editor.press("ControlOrMeta+End");
  await expect(editor).toBeFocused();
  await editor.pressSequentially(` @${searchId}`);
  await task
    .getByRole("button", {
      name: /Segmented mail actions.*family@example.test.*Emails/,
    })
    .click();
  await expect(
    task.locator(`[data-mention][data-type="email"][data-id="${id}"]`),
  ).toHaveCount(2);
  await expect(task.getByPlaceholder("Task title")).toHaveValue(title);
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

test("Email opens in the reading pane and restores the list when going back", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  await signIn(page);
  expect((await page.request.get("/api/email")).ok()).toBe(true);
  const db = localDatabase(baseURL);
  const key = randomUUID();
  const id = `reading-pane-${key}+/=`;
  const folderId = `reading-folder-${key}`;
  const folderName = `Reading pane ${key.slice(0, 8)}`;
  const subject = "Reading pane browser check";
  const alternateId = `${id}-alternate`;
  const alternateSubject = "Another email in the current view";
  const occurredAt = new Date().toISOString();
  for (const result of [
    await db.from("email_folders").upsert({
      id: "browser-inbox", name: "Inbox", role: "inbox", present: true,
    }),
    await db.from("email_folders").insert({ id: folderId, name: folderName, present: true }),
    await db.from("email_threads").insert([{ id }, { id: alternateId }]),
    await db.from("email_messages").insert({
      id, thread_id: id, folder_id: folderId, occurred_at: occurredAt,
      data: {
        id, threadId: id, folderId, subject, bodyText: "This message belongs in the reading pane.",
        sender: "family@example.test", to: ["recipient@example.test"], read: true, draft: false, receivedAt: occurredAt,
      },
    }),
    await db.from("email_messages").insert({
      id: alternateId, thread_id: alternateId, folder_id: folderId, occurred_at: occurredAt,
      data: {
        id: alternateId, threadId: alternateId, folderId, subject: alternateSubject, bodyText: "A different message.",
        sender: "family@example.test", to: ["recipient@example.test"], read: true, draft: false, receivedAt: occurredAt,
      },
    }),
    await db.from("email_record_links").insert({
      thread_id: id, record_type: "student", record_id: "10000000-0000-0000-0000-000000000002", source: "explicit",
    }),
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  await page.goto("/email", { waitUntil: "domcontentloaded" });
  const folder = page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("button", { name: folderName, exact: true });
  const inbox = page.getByRole("region", { name: "Email list" });
  const view = inbox.getByRole("button", { name: "Unassigned", exact: true });
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("button", { name: "Inbox", exact: true }).click();
  await page.getByPlaceholder("Search folders…").fill(folderName);
  await page.getByRole("option", { name: folderName, exact: true }).click();
  await expect(page.getByRole("region", { name: "Email reading pane" })).toHaveCount(0);
  const fullWidth = (await inbox.boundingBox())!.width;
  await view.click();
  const row = inbox.getByRole("button", { name: `Open ${subject}`, exact: true });
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await row.dispatchEvent("dragstart", { dataTransfer: transfer });
  await expect(page.getByRole("dialog", { name: "Email folders" })).toBeVisible();
  await row.dispatchEvent("dragend", { dataTransfer: transfer });
  await expect(page.getByRole("dialog", { name: "Email folders" })).toBeHidden();
  await transfer.dispose();
  const sender = row.getByText("family@example.test", { exact: true });
  const rowSubject = row.getByText(subject, { exact: true });
  await expect.poll(async () => Math.abs((await sender.boundingBox())!.y - (await rowSubject.boundingBox())!.y)).toBeLessThan(2);
  await row.click();

  const email = page.getByRole("article", { name: `Email: ${subject}` });
  await expect(email).toContainText("This message belongs in the reading pane.");
  await email.getByRole("button", { name: "Collapse email from family@example.test" }).click();
  await expect(email.getByRole("button", { name: "Expand email from family@example.test" })).toHaveAttribute("aria-expanded", "false");
  await expect(email.locator("[data-email-preview]")).toHaveText("This message belongs in the reading pane.");
  const messageBody = email.locator("[data-email-body]");
  await expect(messageBody).toHaveAttribute("inert", "");
  await expect(messageBody).toHaveCSS("transition-property", "grid-template-rows");
  await expect.poll(async () => (await messageBody.boundingBox())!.height).toBe(0);
  await email.hover();
  const collapsedBox = (await email.boundingBox())!;
  const actionsBox = (await email.getByRole("group", { name: "Email actions", exact: true }).boundingBox())!;
  expect(Math.abs(collapsedBox.y + collapsedBox.height / 2 - actionsBox.y - actionsBox.height / 2)).toBeLessThan(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(messageBody).toHaveCSS("transition-property", "none");
  await email.getByRole("button", { name: "Expand email from family@example.test" }).click();
  await expect(email.getByRole("button", { name: "Collapse email from family@example.test" })).toHaveAttribute("aria-expanded", "true");
  await expect(messageBody).not.toHaveAttribute("inert");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(inbox).toBeVisible();
  await expect.poll(async () => Math.round((await inbox.boundingBox())?.width ?? 0)).toBe(320);
  expect(fullWidth).toBeGreaterThan(640);
  const display = inbox.getByRole("button", { name: "Display options" });
  await expect.poll(async () => {
    const size = await display.boundingBox();
    return size && Math.round(size.width) === Math.round(size.height);
  }).toBe(true);
  await expect(inbox.locator('[aria-label="Views"] kbd')).toHaveCount(0);
  await display.click();
  const avatarSetting = page.getByRole("dialog", { name: "Display options" }).getByRole("button", { name: "Avatar", exact: true });
  await avatarSetting.click();
  await expect(row.locator("[data-email-avatar]")).toBeVisible();
  await avatarSetting.click();
  await expect(row.locator("[data-email-avatar]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const rowLines = await Promise.all([
    row.getByText("family@example.test", { exact: true }).boundingBox(),
    row.getByText(subject, { exact: true }).boundingBox(),
    row.getByText("This message belongs in the reading pane.", { exact: true }).boundingBox(),
  ]);
  expect(rowLines[0]!.y).toBeLessThan(rowLines[1]!.y);
  expect(rowLines[1]!.y).toBeLessThan(rowLines[2]!.y);
  expect((await display.boundingBox())!.y - (await inbox.boundingBox())!.y).toBeGreaterThanOrEqual(16);
  await expect(page.locator("[data-admin-page-header]")).toHaveCount(1);
  const divider = page.getByRole("separator", { name: "Resize conversation panes" });
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => Math.round((await inbox.boundingBox())?.width ?? 0)).toBe(336);
  expect((await page.getByRole("region", { name: "Email reading pane" }).boundingBox())?.width).toBeGreaterThan(400);
  const participant = page.getByRole("button", { name: "Link recipient@example.test", exact: true });
  await expect(participant).toHaveCount(0);
  await email.getByRole("button", { name: "Show recipients", exact: true }).click();
  await expect(participant).toBeVisible();
  await page.keyboard.press("Escape");

  const name = page.getByRole("button", { name: "Bob Taylor", exact: true });
  await expect(name).toHaveAttribute("data-type", "student");
  await name.click({ button: "right" });
  await expect(page.getByRole("combobox", { name: "Search menu" })).toBeVisible();
  await page.keyboard.press("Escape");

  await inbox.getByRole("button", { name: `Open ${alternateSubject}`, exact: true }).click();
  await expect(page.getByRole("article", { name: `Email: ${alternateSubject}` })).toBeVisible();
  await inbox.getByRole("button", { name: `Open ${subject}`, exact: true }).click();
  await expect(email).toBeVisible();

  await page.setViewportSize({ width: 700, height: 900 });
  await expect(email).toBeVisible();
  await expect(inbox).toBeHidden();
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("button", { name: "Email", exact: true }).click();
  await expect(inbox).toBeVisible();
  await expect(folder).toBeVisible();
  await expect(view).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(inbox).toBeVisible();
  await expect(email).toBeHidden();

  await page.goto(`/email/${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
  await expect(email).toBeVisible();
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("button", { name: "Email", exact: true }).click();
  await expect(folder).toBeVisible();
  await expect(view).toHaveAttribute("aria-pressed", "true");
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
    preview.getByRole("button", { name: "Alice Williams", exact: true }),
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
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}$`));
  const emailChip = page.locator(`[data-admin-main] .tiptap [data-mention][data-type="email"][data-id="${emailId}"]`);
  await emailChip.click({ modifiers: ["Shift"] });
  const emailPane = page.frameLocator('iframe[data-admin-pane-frame][title="Email pane content"]');
  await expect(
    emailPane.getByRole("article", { name: "Email: Exact email reference", exact: true }),
  ).toContainText("The specific referenced email.", { timeout: 30000 });
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}\\?`));
  await expect(page.locator('iframe[data-admin-pane-frame]')).toHaveAttribute('src', new RegExp(`message=${emailId}`));
  await page.getByRole("button", { name: "Close Email pane", exact: true }).click();

  const messageChip = page.locator(`[data-admin-main] .tiptap [data-mention][data-type="message"][data-id="${messageId}"]`);
  await messageChip.click();
  await expect(page).toHaveURL(new RegExp(`/messages\\?.*message=${messageId}`));
  const target = page.locator(`[data-admin-main] [data-message-id="${messageId}"]`);
  await expect(target).toContainText("The specific referenced message.", { timeout: 30000 });
  await expect(target).toBeInViewport();
  await target.evaluate((element) => {
    let parent = element.parentElement;
    while (parent && getComputedStyle(parent).overflowY !== "auto")
      parent = parent.parentElement;
    if (!parent) throw new Error("Message scroll container missing");
    parent.scrollTop = parent.scrollHeight;
  });
  await expect(target).not.toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}`));
  await messageChip.click();
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
  await expect(page).toHaveURL(new RegExp(`/messages\\?.*message=${messageId}`));
});

test("pane resizing preserves edits, keyboard bounds and responsive tabs", async ({
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
  const issueHref = `/issues/${id}`;
  await page.goto(`/students?pane=${encodeURIComponent(issueHref)}&activePane=1`);
  const panel = page.getByRole("region", { name: "Issues pane", exact: true });
  const editor = page.frameLocator('iframe[data-admin-pane-frame][title="Issues pane content"]');
  const title = editor.getByPlaceholder("Issue title");
  await expect(title).toHaveValue(name);
  await title.fill(`${name} edited`);
  const divider = page.getByRole("separator", { name: "Resize adjacent panes", exact: true });
  await divider.press("Escape");
  const width = async () => Math.round((await panel.boundingBox())!.width);
  const before = await width();
  const handle = (await divider.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 180, handle.y + handle.height / 2, { steps: 16 });
  await page.mouse.up();
  await expect.poll(width).toBeGreaterThan(before + 100);
  const resized = await width();
  await divider.press("ArrowRight");
  await expect.poll(width).toBeLessThan(resized);
  await expect(editor.getByRole("status")).toHaveText("Saved");
  await expect(title).toHaveValue(`${name} edited`);

  await page.setViewportSize({ width: 580, height: 900 });
  const tabs = page.locator("[data-admin-navbar]").getByRole("tablist", { name: "Open panes" });
  const issueTab = tabs.getByRole("tab", { name: `${name} edited`, exact: true });
  await expect(issueTab).toHaveAttribute("aria-selected", "true");
  await expect(divider).toBeHidden();
  await page.getByRole("tab", { name: "Students", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Students", exact: true })).toHaveAttribute("aria-selected", "true");
  await issueTab.click();
  await page.reload();
  await expect(title).toHaveValue(`${name} edited`);
});

test("compact workspace names the student tab and keeps its record header visible", async ({ page }) => {
  await page.setViewportSize({ width: 580, height: 740 });
  await signIn(page);
  await page.goto("/students/10000000-0000-0000-0000-000000000002?pane=%2Fparents");
  const tabs = page.locator("[data-admin-navbar]").getByRole("tablist", { name: "Open panes" });
  await expect(tabs.getByRole("tab", { name: "Bob Taylor", exact: true })).toHaveAttribute("aria-selected", "true");
  const header = page.getByRole("tabpanel", { name: "Bob Taylor", exact: true }).locator("[data-admin-page-header]");
  await expect(header.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Bob Taylor");
  const position = await header.evaluate((bar) => {
    const scrollingContent = bar.parentElement;
    if (!scrollingContent) throw new Error("No student content");
    const spacer = document.createElement("div");
    spacer.style.height = "150vh";
    scrollingContent.append(spacer);
    const before = bar.getBoundingClientRect().top;
    scrollingContent.scrollTop = 200;
    return { before, after: bar.getBoundingClientRect().top, scrolled: scrollingContent.scrollTop };
  });
  expect(position.scrolled).toBeGreaterThan(0);
  expect(position.after).toBeLessThanOrEqual(position.before);
  expect(position.after).toBeGreaterThanOrEqual(position.before - 16);

  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/students/10000000-0000-0000-0000-000000000002?pane=%2Fparents&pane=%2Ftasks&activePane=2");
  const taskTab = tabs.getByRole("tab", { name: "Tasks", exact: true });
  await expect(taskTab).toHaveAttribute("aria-selected", "true");
  await expect(taskTab).toBeInViewport({ ratio: 1 });
});

test("the top bar aligns with the workspace and contracts the sidebar before tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1320, height: 740 });
  await signIn(page);
  await page.goto("/students/10000000-0000-0000-0000-000000000010?pane=%2Fparents&pane=%2Ftasks");
  const navbar = page.locator("[data-admin-navbar]");
  const sidebar = page.locator("[data-admin-sidebar]");
  const workspace = page.locator("[data-admin-pane-workspace]");
  const tabs = navbar.getByRole("tablist", { name: "Open panes" });
  const header = workspace.locator("[data-admin-page-header]").first();
  await expect(header).toContainText("Julia Hall");
  await expect(navbar.getByRole("img", { name: "Altitutor" })).toHaveCount(0);
  const navBox = (await navbar.boundingBox())!;
  expect(navBox.y).toBe(0);
  expect((await header.boundingBox())!.y).toBeCloseTo(navBox.y + navBox.height + 1, 0);

  const search = navbar.getByRole("button", { name: "Open command palette" });
  const notifications = navbar.getByRole("button", { name: /^Notifications/ });
  const searchBox = (await search.boundingBox())!;
  const notificationsBox = (await notifications.boundingBox())!;
  expect([searchBox.width, searchBox.height]).toEqual([32, 32]);
  expect([notificationsBox.width, notificationsBox.height]).toEqual([32, 32]);
  await search.hover();
  await expect(page.getByRole("tooltip")).toContainText("Search");
  await page.keyboard.press("Escape");
  await page.mouse.move(1, 1, { steps: 8 });
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await notifications.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Notifications");
  await notifications.click();
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.move(1, 1);
  for (const [modifier, keycap] of [["Meta", "⌘"], ["Control", "Ctrl"]]) {
    await page.keyboard.down(modifier);
    await expect(search.locator("kbd")).toHaveText([keycap, "K"]);
    await page.keyboard.up(modifier);
    await expect(search.locator("kbd")).toHaveCount(0);
  }

  const firstDivider = workspace.getByRole("separator", { name: "Resize adjacent panes" }).first();
  for (let step = 0; step < 5; step += 1) await firstDivider.press("ArrowLeft");
  await page.setViewportSize({ width: 1040, height: 740 });
  await expect(navbar.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await expect(tabs).toHaveCount(0);
  expect((await workspace.getByRole("region", { name: "Students pane", exact: true }).boundingBox())!.width).toBeGreaterThanOrEqual(305);
  await navbar.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(tabs).toBeVisible();
  const sidebarBox = (await sidebar.boundingBox())!;
  const tabsBox = (await tabs.boundingBox())!;
  expect(sidebarBox.width).toBe(250);
  expect(tabsBox.x).toBe((await workspace.getByRole("tabpanel").boundingBox())!.x);
  await page.setViewportSize({ width: 1320, height: 740 });
  await expect(tabs).toHaveCount(0);
  await page.setViewportSize({ width: 980, height: 740 });
  await expect(navbar.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await expect(tabs).toBeVisible();
  expect((await sidebar.boundingBox())!.width).toBe(70);
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
  const classes = await db
    .from("classes")
    .select("id")
    .eq("id", "20000000-0000-0000-0000-000000000001")
    .single();
  if (classes.error) throw new Error("Scheduling fixtures unavailable");
  const loggedSessionId = "50000000-0000-0000-0000-000000000001";
  await signIn(page);
  const cases: Array<[string, string, string[]]> = [
    ["parent", "60000000-0000-0000-0000-000000000001", ["Students"]],
    ["staff", "00000000-0000-0000-0000-000000000010", ["Role", "Classes"]],
    [
      "class",
      classes.data.id,
      ["Subject", "Scheduled offerings", "Students (3)", "Staff"],
    ],
    ["session", loggedSessionId, ["Subject", "Day", "Time"]],
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
    if (type === "session") {
      expect(details.logged).toBe(true);
      expect(details.people).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "Student",
            id: "10000000-0000-0000-0000-000000000003",
            plannedStatus: "absent",
            actualAttended: false,
          }),
          expect.objectContaining({
            role: "Staff",
            id: "00000000-0000-0000-0000-000000000010",
            plannedStatus: "attending",
            actualAttended: true,
          }),
        ]),
      );
    }
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
  const panel = page.locator("[data-admin-main]");
  const urgent = panel.getByRole("button", { name: "Urgent", exact: true }).first();
  await expect(urgent).toBeVisible();
  await urgent.click();
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
  await expect(panel.getByRole("button", { name: "High", exact: true }).first()).toBeVisible();
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

  await panel.getByRole("button", { name: "Record actions", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Add issue", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/students/10000000-0000-0000-0000-000000000001");
  await page.locator("[data-admin-main]").getByRole("button", { name: "Record actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add issue", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Create Issue",
    exact: true,
  });
  await dialog
    .getByPlaceholder("Issue title")
    .fill(`Created with priority ${randomUUID()}`);
  await dialog.getByRole("button", { name: "Right sidebar", exact: true }).click();
  const createSidebar = dialog.getByRole("dialog", { name: "Right sidebar", exact: true });
  await expect(createSidebar).toBeVisible();
  await createSidebar.getByRole("button", { name: "No priority", exact: true }).click();
  await page.getByRole("option", { name: "Medium", exact: true }).click();
  await expect(createSidebar.getByRole("button", { name: "Medium", exact: true })).toBeVisible();
  await createSidebar.getByRole("button", { name: "Close sidebar", exact: true }).click();
  await expect(createSidebar).toBeHidden();
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

test("message chips reveal closed groups independently of the filtered inbox", async ({
  page,
  baseURL,
}) => {
  await signIn(page);
  const db = localDatabase(baseURL);
  const conversationId = randomUUID(),
    senderId = randomUUID(),
    messageId = randomUUID(),
    taskId = randomUUID();
  const results = [
    await db
      .from("owned_numbers")
      .insert({
        id: senderId,
        phone_e164: `+614${String(Date.now()).slice(-8)}`,
        label: "Closed group sender",
        provider: "IMESSAGE",
        sender_type: "PHONE",
      }),
    await db
      .from("conversations")
      .insert({
        id: conversationId,
        owned_number_id: senderId,
        status: "CLOSED",
        is_group_chat: true,
        group_chat_id: `chat-${randomUUID()}`,
        group_chat_name: "Archived reference group",
      }),
    await db
      .from("messages")
      .insert({
        id: messageId,
        conversation_id: conversationId,
        body: "The referenced closed-group message.",
        direction: "INBOUND",
        status: "RECEIVED",
        from_number_e164: "+61427700001",
        to_number_e164: "+61427700002",
      }),
    await db
      .from("tasks")
      .insert({
        id: taskId,
        title: "Closed-group reference task",
        description: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "mention",
                  attrs: {
                    type: "message",
                    id: messageId,
                    label: "Archived group message",
                  },
                },
              ],
            },
          ],
        },
      }),
  ];
  for (const result of results) if (result.error) throw result.error;
  await page.goto(`/tasks/${taskId}`);
  await page
    .locator(`[data-mention][data-type="message"][data-id="${messageId}"]`)
    .click();
  const panel = page.locator("[data-admin-main]");
  await expect(page).toHaveURL(new RegExp(`/messages\\?.*message=${messageId}`));
  const message = panel.locator(`[data-message-id="${messageId}"]`);
  await expect(message).toContainText("The referenced closed-group message.");
  await expect(message).toBeInViewport();
  await expect(
    panel.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Archived reference group");
});
