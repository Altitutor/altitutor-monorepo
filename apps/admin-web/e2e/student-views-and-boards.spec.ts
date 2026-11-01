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
  const journey = await db.from('onboarding_journeys').upsert({ id: '28200000-0000-4000-8000-000000000002', student_id: studentId, label: 'Journey Browser check', enquiry_at: '2026-10-30T12:00:00Z' });
  if (journey.error) throw journey.error;
  const family = await db.from('onboarding_journeys').upsert({ id: '28200000-0000-4000-8000-000000000004', label: 'Family browser enquiry', enquiry_email: 'family-browser-check@altitutor.test', enquiry_at: '2026-10-30T12:00:00Z' });
  if (family.error) throw family.error;
  const sender = await db.from('owned_numbers').upsert({ id: '28200000-0000-4000-8000-000000000003', phone_e164: '+61428200000', label: 'Browser iMessage', provider: 'IMESSAGE', sender_type: 'PHONE' });
  if (sender.error) throw sender.error;
  const tasks = await db.from('tasks').upsert(Array.from({ length: 90 }, (_, index) => ({ id: `28200001-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, title: `Board drag check ${String(index + 1).padStart(3, '0')}`, status: ['backlog', 'todo', 'in_progress'][index % 3], priority: 1 })));
  if (tasks.error) throw tasks.error;
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
  const studentsToolbar = await page.getByRole('button', { name: 'Display options', exact: true }).boundingBox();
  for (const path of ['/tasks', '/issues', '/projects']) {
    await page.locator(`nav a[href="${path}"]`).click();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toContainText(path.slice(1).replace(/^./, char => char.toUpperCase()));
    const display = page.getByRole('button', { name: 'Display options', exact: true });
    await expect(display).toBeVisible({ timeout: 30_000 });
    const toolbar = await display.boundingBox();
    expect(Math.abs(toolbar!.y - studentsToolbar!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(toolbar!.x - studentsToolbar!.x)).toBeLessThanOrEqual(1);
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
