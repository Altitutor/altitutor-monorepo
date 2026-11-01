import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

test.setTimeout(120_000);

const studentId = '28200000-0000-4000-8000-000000000001';
test.beforeAll(async () => {
  const url = process.env.ADMIN_E2E_SUPABASE_URL!;
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Fixtures require a local database');
  const db = createClient<Database>(url, process.env.ADMIN_E2E_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const student = await db.from('students').upsert({ id: studentId, first_name: 'Journey', last_name: 'Browser check', status: 'TRIAL' });
  if (student.error) throw student.error;
  const online = await db.from('students').upsert({ id: '28200000-0000-4000-8000-000000000005', first_name: 'Unified Online', last_name: 'Browser check', status: null });
  if (online.error) throw online.error;
  const product = await db.from('student_online_product_relationships').upsert({ student_id: '28200000-0000-4000-8000-000000000005', product: 'UCAT_WEB', started_at: '2026-10-01T12:00:00Z' }, { onConflict: 'student_id,product' });
  if (product.error) throw product.error;

  const journey = await db.from('onboarding_journeys').upsert({ id: '28200000-0000-4000-8000-000000000002', student_id: studentId, label: 'Journey Browser check', enquiry_at: '2026-10-30T12:00:00Z' });
  if (journey.error) throw journey.error;
  const family = await db.from('onboarding_journeys').upsert({ id: '28200000-0000-4000-8000-000000000004', label: 'Family browser enquiry', enquiry_email: 'family-browser-check@altitutor.test', enquiry_at: '2026-10-30T12:00:00Z' });
  if (family.error) throw family.error;
  const closedStudent = await db.from('students').upsert({ id: '28200000-0000-4000-8000-000000000006', first_name: 'Completed onboarding', last_name: 'Browser check', status: 'ACTIVE' });
  if (closedStudent.error) throw closedStudent.error;
  const closedJourney = await db.from('onboarding_journeys').upsert({ id: '28200000-0000-4000-8000-000000000007', student_id: '28200000-0000-4000-8000-000000000006', label: 'Completed onboarding Browser check', enquiry_at: '2026-10-30T12:00:00Z', closed_at: null, closure_reason: null, closed_evidence: null });
  if (closedJourney.error) throw closedJourney.error;
  const closedFamily = await db.from('onboarding_journeys').upsert({ id: '28200000-0000-4000-8000-000000000008', label: 'Completed family enquiry Browser check', enquiry_email: 'completed-family-browser@altitutor.test', enquiry_at: '2026-10-30T12:00:00Z', closed_at: null, closure_reason: null, closed_evidence: null });
  if (closedFamily.error) throw closedFamily.error;
  const closed = await db.from('onboarding_journeys').update({ closed_at: '2026-10-31T12:00:00Z', closure_reason: 'completed' }).in('id', ['28200000-0000-4000-8000-000000000007', '28200000-0000-4000-8000-000000000008']);
  if (closed.error) throw closed.error;
  const sender = await db.from('owned_numbers').upsert({ id: '28200000-0000-4000-8000-000000000003', phone_e164: '+61428200000', label: 'Browser iMessage', provider: 'IMESSAGE', sender_type: 'PHONE' });
  if (sender.error) throw sender.error;
  const tasks = await db.from('tasks').upsert(Array.from({ length: 90 }, (_, index) => ({ id: `28200001-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, title: `Board drag check ${String(index + 1).padStart(3, '0')}`, status: ['backlog', 'todo', 'in_progress'][index % 3], priority: 1 })));
  if (tasks.error) throw tasks.error;
  const done = await db.from('tasks').upsert({ id: '28200001-0000-4000-8000-000000000091', title: 'Board edge done', status: 'done' });
  if (done.error) throw done.error;
});

async function signIn(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill('admin@altitutor.test');
  await page.getByPlaceholder('Enter your password').fill('test-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard\//, { timeout: 30_000 });
}

test('Student views share one directory and open the Student page', async ({ page }) => {
  await signIn(page);
  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  const views = page.getByLabel('Views', { exact: true });
  await expect(views.getByRole('button', { name: 'In person', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await views.getByRole('button', { name: 'Online', exact: true }).click();
  await expect(page).toHaveURL(/\/students\?/);
  await expect(page.getByRole('row').filter({ hasText: 'StudentProductsOnline since' })).toBeVisible();
  await views.getByRole('button', { name: 'Trial', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Enquiry', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Family browser enquiry/ }).click();
  const enquiry = page.getByRole('dialog');
  const nextContact = enquiry.getByRole('button', { name: /Agreed next contact date/ });
  await nextContact.scrollIntoViewIfNeeded();
  await expect(nextContact).toBeInViewport();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Journey Browser check / }).click();
  await expect(page).toHaveURL(new RegExp(`/students/${studentId}`));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  await page.getByText('Alice Williams', { exact: true }).click();
  await expect(page).toHaveURL(/\/students\/[\da-f-]+/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/online-students');
  await expect(page).toHaveURL(/\/students\?/);
  await expect(views.getByRole('button', { name: 'Online', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/trial-students');
  await expect(views.getByRole('button', { name: 'Trial', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('Student onboarding stays accessible in a responsive collapsible sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto(`/students/${studentId}`);
  const toggle = page.getByRole('button', { name: 'Toggle onboarding sidebar', exact: true });
  const sidebar = page.getByRole('complementary', { name: 'Student onboarding', exact: true });
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'Next actions' })).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'Milestones' })).toBeVisible();
  await expect(sidebar.getByText('Enquiry', { exact: true })).toBeVisible();
  await toggle.click();
  await expect(sidebar).toBeHidden();
  await toggle.click();
  await expect(sidebar).toBeVisible();
  await page.setViewportSize({ width: 850, height: 900 });
  await expect(sidebar).toBeHidden();
  await toggle.click();
  await expect(sidebar).toBeVisible();
  await toggle.click();
  await expect(sidebar).toBeHidden();
});

test('closing onboarding refreshes the Student page without reloading', async ({ page }) => {
  const id = randomUUID();
  const url = process.env.ADMIN_E2E_SUPABASE_URL!;
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Fixtures require a local database');
  const db = createClient<Database>(url, process.env.ADMIN_E2E_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const student = await db.from('students').insert({ id, first_name: 'Close journey', last_name: 'Browser check', status: 'TRIAL' });
  if (student.error) throw student.error;
  const journey = await db.from('onboarding_journeys').insert({ student_id: id, label: 'Close journey Browser check', enquiry_at: '2026-10-30T12:00:00Z' });
  if (journey.error) throw journey.error;
  await page.setViewportSize({ width: 1600, height: 900 });
  await signIn(page);
  await page.goto(`/students/${id}`, { waitUntil: 'domcontentloaded' });
  const toggle = page.getByRole('button', { name: 'Toggle onboarding sidebar', exact: true });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const sidebar = page.getByRole('complementary', { name: 'Student onboarding', exact: true });
  await expect(sidebar).toBeVisible();
  await sidebar.getByText('Close journey', { exact: true }).click();
  await sidebar.getByLabel('Closure reason').selectOption('withdrawn');
  await sidebar.getByLabel('Closure detail').fill('Local browser regression: explicit withdrawal');
  await sidebar.getByRole('button', { name: 'Close and discontinue', exact: true }).click();
  await expect(toggle).toBeHidden();
  await expect(sidebar).toBeHidden();
});

test('individual conversations start with Emails hidden and allow opting in', async ({ page }) => {
  await signIn(page);
  await page.goto('/messages');
  await page.getByRole('button', { name: /^Alice Williams / }).click();
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  const emails = page.getByRole('menuitemcheckbox', { name: 'Emails', exact: true });
  await expect(emails).toHaveAttribute('aria-checked', 'false');
  await emails.click();
  await expect(emails).toHaveAttribute('aria-checked', 'true');
});

test('work-item boards align toolbars, span the page and scroll columns independently', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await signIn(page);
  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  // Wait for the page action portal before measuring the header's final height.
  await expect(page.getByRole('button', { name: 'Add Student', exact: true })).toBeVisible();
  const toolbarInsets = async () => {
    const button = (await page.getByRole('button', { name: 'Display options', exact: true }).boundingBox())!;
    const main = (await page.locator('[data-admin-main]').boundingBox())!;
    const header = (await page.locator('[data-admin-page-header]').boundingBox())!;
    return { right: Math.round(main.x + main.width - button.x - button.width), top: Math.round(button.y - header.y - header.height) };
  };
  // Compare page insets, so the shell's width animation cannot skew the reference.
  await expect.poll(toolbarInsets).toEqual({ right: 24, top: 26 });
  const studentsToolbar = await toolbarInsets();
  for (const path of ['/tasks', '/issues', '/projects']) {
    await page.locator(`nav a[href="${path}"]`).click();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toContainText(path.slice(1).replace(/^./, char => char.toUpperCase()));
    const display = page.getByRole('button', { name: 'Display options', exact: true });
    await expect(display).toBeVisible({ timeout: 30_000 });
    await expect.poll(toolbarInsets).toEqual(studentsToolbar);
    const board = page.getByRole('region', { name: 'Board', exact: true });
    await expect(board).toBeVisible();
    expect(await board.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    const main = await page.locator('[data-admin-main]').boundingBox();
    const boardBox = await board.boundingBox();
    expect(Math.abs(boardBox!.x - main!.x)).toBeLessThanOrEqual(1);
    if (path === '/tasks') {
      const backlog = board.getByRole('region', { name: 'Backlog column', exact: true });
      const todo = board.getByRole('region', { name: 'Todo column', exact: true });
      await backlog.hover();
      await page.mouse.wheel(0, 300);
      await expect.poll(() => backlog.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      expect(await todo.evaluate(el => el.scrollTop)).toBe(0);
      await page.mouse.wheel(500, 0);
      await expect.poll(() => board.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
  }
});

test('conversation composer collapses controls to tooltip-equipped icons before overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1074, height: 900 });
  await signIn(page);
  await page.goto('/messages');
  await page.getByRole('button', { name: /^Alice Williams / }).click();
  const controls = page.locator('[data-message-composer-controls]');
  await expect(controls).toBeVisible();
  // The sender picker also covers long phone numbers and the attachment control.
  await controls.getByRole('button', { name: /Select sender|\+61400000000/ }).click();
  await page.getByRole('option', { name: /\+61428200000/ }).click();
  const template = controls.getByRole('button', { name: 'Template', exact: true });
  await expect(template).toHaveText('');
  const buttons = controls.getByRole('button');
  const boxes = await buttons.evaluateAll(elements => elements.map(el => { const rect = el.getBoundingClientRect(); return { top: rect.top, right: rect.right, left: rect.left }; }));
  expect(Math.max(...boxes.map(box => box.top)) - Math.min(...boxes.map(box => box.top))).toBeLessThan(2);
  for (const label of ['Template', 'Insert variable', 'Attach files', 'Select sender']) {
    await controls.getByRole('button', { name: label, exact: true }).hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
  }
});

test('date and priority pills share their surface in board and detail views', async ({ page }) => {
  await signIn(page);
  await page.goto('/tasks?search=Board%20drag%20check');
  const card = page.getByRole('region', { name: 'Backlog column', exact: true }).getByRole('button', { name: /^Board drag check 001 / });
  const surface = (button: ReturnType<Page['getByRole']>) => button.evaluate(el => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius, height: style.height, font: style.fontWeight };
  });
  await expect(card).toBeVisible();
  const priorityStyle = await surface(card.getByRole('button', { name: 'Urgent', exact: true }));
  expect(await surface(card.getByRole('button', { name: 'Date', exact: true }))).toEqual(priorityStyle);
  await card.getByText('Board drag check 001', { exact: true }).click();
  const detail = page.locator('#admin-accessory-panel');
  await expect(detail.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toContainText('Board drag check 001');
  expect(await surface(detail.getByRole('button', { name: 'Date', exact: true }))).toEqual(priorityStyle);
});

test('Messages accessory breadcrumb returns to the primary Messages collection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/messages');
  await page.getByRole('button', { name: /^Alice Williams / }).click();
  const panel = page.locator('#admin-accessory-panel');
  await expect(panel.locator('[data-message-composer-controls]')).toBeVisible();
  await page.locator('nav a[href="/tasks"]').click();
  await expect(page.locator('[data-admin-main]').getByRole('navigation', { name: 'Breadcrumb', exact: true })).toContainText('Tasks');
  await panel.getByRole('navigation', { name: 'Breadcrumb', exact: true }).getByRole('button', { name: 'Messages', exact: true }).click();
  await expect(page).toHaveURL(/\/messages$/);
  await expect(page.locator('[data-admin-main]').getByRole('navigation', { name: 'Breadcrumb', exact: true })).toContainText('Messages');
  await expect(page.locator('[data-admin-main]').getByPlaceholder('Search conversations')).toBeVisible();
});

declare global {
  interface Window {
    boardDragMeasurement?: { running: boolean; lastFrame: number; frames: number[] };
  }
}

test('board dragging stays responsive and persists a cross-column move', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/tasks?search=Board%20drag%20check');
  const backlog = page.getByRole('region', { name: 'Backlog column', exact: true });
  const todo = page.getByRole('region', { name: 'Todo column', exact: true });
  const card = backlog.locator('[aria-roledescription="sortable"]').first();
  await expect(card).toBeVisible();
  const title = (await card.innerText()).split('\n')[0];
  const measurements: number[] = [];
  for (let trial = 0; trial < 3; trial++) {
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + 50, box.y + 15);
    await page.evaluate(() => {
      const measurement = { running: true, lastFrame: performance.now(), frames: [] as number[] };
      window.boardDragMeasurement = measurement;
      const frame = (now: number) => {
        if (!measurement.running) return;
        measurement.frames.push(now - measurement.lastFrame);
        measurement.lastFrame = now;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await page.mouse.down();
    for (let step = 1; step <= 50; step++) {
      await page.mouse.move(box.x + 50 + step * 7, box.y + 15 + Math.sin(step / 6) * 25);
      await page.waitForTimeout(16);
    }
    await page.keyboard.press('Escape');
    await page.mouse.up();
    measurements.push(await page.evaluate(() => {
      const measurement = window.boardDragMeasurement!;
      measurement.running = false;
      return Math.max(...measurement.frames);
    }));
  }
  test.info().annotations.push({ type: 'drag-max-frame-ms', description: JSON.stringify(measurements) });
  expect([...measurements].sort((left, right) => left - right)[1]).toBeLessThan(150);
  const from = (await card.boundingBox())!;
  const target = (await todo.boundingBox())!;
  await page.mouse.move(from.x + 50, from.y + 15);
  await page.mouse.down();
  await page.mouse.move(target.x + 50, target.y + 20, { steps: 25 });
  await page.mouse.up();
  await expect(todo.getByText(title, { exact: true })).toBeVisible();
  await page.reload();
  await expect(todo.getByText(title, { exact: true })).toBeVisible();
});


test('board outer card edges align with the toolbar at both horizontal ends', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/tasks', { waitUntil: 'domcontentloaded' });
  const board = page.getByRole('region', { name: 'Board', exact: true });
  const firstCard = board.getByRole('region', { name: 'Backlog column', exact: true }).locator('[aria-roledescription="sortable"]').first();
  const firstView = page.getByLabel('Views', { exact: true }).getByRole('button').first();
  await expect(firstCard).toBeVisible();
  await expect.poll(async () => Math.abs((await firstCard.boundingBox())!.x - (await firstView.boundingBox())!.x)).toBeLessThanOrEqual(1);
  await board.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  const lastCard = board.getByRole('region', { name: 'Done column', exact: true }).getByText('Board edge done', { exact: true }).locator('..');
  await expect(lastCard).toBeInViewport();
  const display = page.getByRole('button', { name: 'Display options', exact: true });
  await expect.poll(async () => {
    const card = (await lastCard.boundingBox())!;
    const control = (await display.boundingBox())!;
    return Math.abs(card.x + card.width - control.x - control.width);
  }).toBeLessThanOrEqual(1);
});


test('the accessory panel offers only individual records and recently closed', async ({ page }) => {
  await signIn(page);
  await page.goto('/tasks', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Expand accessory panel', exact: true }).click();
  const panel = page.locator('#admin-accessory-panel');
  await expect(panel.getByRole('button', { name: 'Tasks', exact: true })).toHaveCount(0);
  await expect(panel.getByRole('heading', { name: 'Recently closed', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Add accessory tab', exact: true }).click();
  const picker = page.getByRole('dialog');
  await expect(picker.getByText('Views', { exact: true })).toHaveCount(0);
  await picker.getByRole('combobox').fill('tasks');
  await expect(picker.getByRole('option', { name: /^Tasks/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+t');
  await expect(panel.getByRole('tab')).toHaveCount(0);
  await page.locator('[data-admin-main]').getByText('Board drag check 001', { exact: true }).click();
  await expect(panel.getByRole('tab', { name: 'Board drag check 001', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Close Board drag check 001 tab', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Recently closed', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Board drag check 001', exact: true }).click();
  await expect(panel.getByRole('tab', { name: 'Board drag check 001', exact: true })).toBeVisible();
});


test('Student presets share every column and clearing filters reveals every relationship', async ({ page }) => {
  await signIn(page);
  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  const display = page.getByRole('button', { name: 'Display options', exact: true });
  await display.click();
  const options = page.getByRole('dialog', { name: 'Display options', exact: true });
  for (const column of ['Products', 'Online since', 'Onboarding status']) {
    await expect(options.getByRole('button', { name: column, exact: true })).toBeVisible();
    await options.getByRole('button', { name: column, exact: true }).click();
  }
  await options.getByRole('button', { name: 'Clear all filters', exact: true }).click();
  await page.keyboard.press('Escape');
  for (const name of ['Alice Williams', 'Journey Browser check', 'Unified Online Browser check']) {
    await expect(page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) })).toBeVisible();
  }
  await expect(page.getByRole('row').filter({ hasText: 'Unified Online Browser check' })).toContainText('Altitutor UCAT');
  const views = page.getByLabel('Views', { exact: true });
  await views.getByRole('button', { name: 'Online', exact: true }).click();
  await display.click();
  await expect(options.getByRole('button', { name: 'Onboarding status', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await views.getByRole('button', { name: 'Trial', exact: true }).click();
  await display.click();
  await options.getByRole('button', { name: 'Clear all filters', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Board', exact: true }).getByText('Unified Online Browser check', { exact: true })).toBeVisible();
  const board = page.getByRole('region', { name: 'Board', exact: true });
  const viewEdge = (await views.getByRole('button', { name: 'In person', exact: true }).boundingBox())!.x;
  const firstCard = board.getByRole('button', { name: /^Family browser enquiry/ });
  expect(Math.abs((await firstCard.boundingBox())!.x - viewEdge)).toBeLessThanOrEqual(1);
  await board.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  const lastCard = board.getByRole('button', { name: /^Unified Online Browser check/ });
  const card = (await lastCard.boundingBox())!;
  const toolbar = (await display.boundingBox())!;
  expect(Math.abs(card.x + card.width - toolbar.x - toolbar.width)).toBeLessThanOrEqual(1);
});


test('restored accessory state discards collection tabs and collection history', async ({ page }) => {
  await signIn(page);
  await page.goto('/tasks', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-admin-main]').getByText('Board drag check 001', { exact: true }).click();
  const panel = page.locator('#admin-accessory-panel');
  await expect(panel.getByRole('tab', { name: 'Board drag check 001', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('admin-accessory-v1:'))!;
    const saved = JSON.parse(localStorage.getItem(key)!);
    for (const kind of ['tasks', 'messages', 'email']) {
      const collection = { key: `legacy-${kind}`, kind, title: `Legacy ${kind}`, query: '' };
      saved.tabs.push(collection);
      saved.recentlyClosed.push(collection);
    }
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(panel.getByRole('tab', { includeHidden: true })).toHaveCount(1);
  if (!await panel.isVisible()) await page.getByRole('button', { name: 'Expand accessory panel', exact: true }).click();
  await panel.getByRole('button', { name: 'Close Board drag check 001 tab', exact: true }).click();
  for (const kind of ['tasks', 'messages', 'email']) {
    await expect(panel.getByRole('button', { name: `Legacy ${kind}`, exact: true })).toHaveCount(0);
  }
  await expect(panel.getByRole('button', { name: 'Board drag check 001', exact: true })).toBeVisible();
});


test('Student directory filters the whole dataset before pagination and denies anonymous access', async ({ page, request }) => {
  const input = { search: 'Browser check', filters: {}, sortBy: 'last_name', sortDirection: 'asc', page: 1, pageSize: 1 };
  const denied = await request.post('/api/students/directory', { data: input });
  expect(denied.status()).toBe(401);
  await signIn(page);
  const first = await page.request.post('/api/students/directory', { data: input });
  expect(first.ok()).toBe(true);
  const firstPage = await first.json();
  expect(firstPage.total).toBeGreaterThanOrEqual(2);
  expect(firstPage.entries).toHaveLength(1);
  const second = await page.request.post('/api/students/directory', { data: { ...input, page: 2 } });
  const secondPage = await second.json();
  expect(secondPage.total).toBe(firstPage.total);
  expect(secondPage.entries).toHaveLength(1);
  expect(secondPage.entries[0].id).not.toBe(firstPage.entries[0].id);
  const online = await page.request.post('/api/students/directory', { data: { ...input, filters: { relationship: ['online'], product: ['UCAT_WEB'] } } });
  const onlinePage = await online.json();
  expect(onlinePage.total).toBe(1);
  expect(onlinePage.entries[0]).toMatchObject({ kind: 'student', student: { status: null }, label: 'Unified Online Browser check' });
  const mixed = await page.request.post('/api/students/directory', { data: { ...input, pageSize: 50, filters: { relationship: ['online', 'trial'] } } });
  const mixedPage = await mixed.json();
  expect(mixedPage.entries.map((entry: { label: string }) => entry.label)).toEqual(expect.arrayContaining(['Unified Online Browser check', 'Journey Browser check']));
  const families = await page.request.post('/api/students/directory', { data: { ...input, search: 'Family browser enquiry', filters: { relationship: ['trial'], queue: ['open'] } } });
  expect((await families.json()).entries[0]).toMatchObject({ kind: 'enquiry', student: null, label: 'Family browser enquiry' });
});


test('Trial queue can show completed onboarding for active Students and family enquiries', async () => {
  const db = createClient<Database>(process.env.ADMIN_E2E_SUPABASE_URL!, (process.env.ADMIN_E2E_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await db.auth.signInWithPassword({ email: 'admin@altitutor.test', password: 'test-password' });
  if (signedIn.error) throw signedIn.error;
  const response = await db.rpc('search_student_directory_admin', {
    p_request: { search: 'Completed', filters: { relationship: ['trial'], queue: ['closed'] }, page: 1, pageSize: 50 },
    p_journeys: [
      { id: '28200000-0000-4000-8000-000000000007', student_id: '28200000-0000-4000-8000-000000000006', stage: 'Enquiry', open: false },
      { id: '28200000-0000-4000-8000-000000000008', student_id: null, stage: 'Enquiry', open: false },
    ],
  });
  if (response.error) throw response.error;
  const result = response.data as { entries: Array<{ kind: string; student: { status: string } | null; label: string }> };
  expect(result.entries).toHaveLength(2);
  expect(result.entries.find(entry => entry.kind === 'student')).toMatchObject({ student: { status: 'ACTIVE' } });
  expect(result.entries.find(entry => entry.kind === 'enquiry')).toMatchObject({ student: null, label: 'Completed family enquiry Browser check' });
});
