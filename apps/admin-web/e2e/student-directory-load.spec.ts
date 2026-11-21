import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

test.setTimeout(120_000);

const fixturePrefix = '48800000-0000-4000-8000-';
const search = 'Directory load boundary';
const frozenEvidence = {
  trial_start_at: null, trial_booked_at: null, trial_session_id: null,
  trial_attended_at: null, trial_form_at: null, registration_link_at: null,
  billing_at: null, registered_at: '2026-10-19T12:00:00Z',
  subjects: [], classes: [], followups: [], checkin_booked_at: null,
  converted_at: null, paid_session_id: null, paid_invoice_id: null,
  checkin_at: null, checkin_session_id: null,
};

const fixtureStudentIds = [
  ...Array.from({ length: 205 }, (_, index) => fixturePrefix + String(index + 1).padStart(12, '0')),
  '48820000-0000-4000-8000-000000000001', '48820000-0000-4000-8000-000000000003',
];
const fixtureJourneyLabels = new Map([
  ...Array.from({ length: 205 }, (_, index): [string, string] => [
    '48810000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
    index === 0 ? 'Directory scoped current' : 'Directory scoped other ' + (index + 1),
  ]),
  ['48810000-0000-4000-8000-000000000206', 'Newer closed history'],
  ['48810000-0000-4000-8000-000000000207', search + ' Family'],
  ['48820000-0000-4000-8000-000000000002', 'Open returning enquiry'],
  ['48820000-0000-4000-8000-000000000004', 'Closed returning enquiry'],
]);

function fixtureDatabase() {
  const url = process.env.ADMIN_E2E_SUPABASE_URL!;
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Directory fixtures require the owned local database');
  return createClient<Database>(url, process.env.ADMIN_E2E_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ownedFixtureStudents(db: ReturnType<typeof fixtureDatabase>) {
  const students = await db.from('students').select('id,first_name,last_name,deleted_at,user_id,email,phone').in('id', fixtureStudentIds);
  if (students.error) throw students.error;
  for (const student of students.data) {
    const expectedName = student.id.startsWith(fixturePrefix) ? search : 'Directory returning boundary';
    const expectedLastName = student.id.startsWith(fixturePrefix) ? student.id.slice(-3)
      : student.id.endsWith('1') ? 'Open' : 'Closed';
    if (student.first_name !== expectedName || student.last_name !== expectedLastName ||
      student.user_id !== null || student.email !== null || student.phone !== null) {
      throw new Error('Refusing to change a Student outside the directory fixture ownership boundary');
    }
  }
  return students.data;
}

async function fixtureAdmin() {
  const db = fixtureDatabase();
  const login = await db.auth.signInWithPassword({ email: 'admin@altitutor.test', password: 'test-password' });
  if (login.error) throw login.error;
  return db;
}

test.beforeAll(async () => {
  const db = fixtureDatabase();
  const existing = await ownedFixtureStudents(db);
  if (existing.some(student => student.deleted_at !== null)) {
    const admin = await fixtureAdmin();
    for (const student of existing.filter(student => student.deleted_at !== null)) {
      const restored = await admin.rpc('restore_student', { p_student_id: student.id });
      if (restored.error) throw restored.error;
    }
  }
  const result = await db.from('students').upsert(
    Array.from({ length: 205 }, (_, index) => ({
      id: fixturePrefix + String(index + 1).padStart(12, '0'),
      first_name: search,
      last_name: String(index + 1).padStart(3, '0'),
      status: 'TRIAL' as const,
      registered_at: null,
    })),
  );
  if (result.error) throw result.error;
  const journeys = await db.from('onboarding_journeys').upsert(Array.from({ length: 205 }, (_, index) => ({
    id: '48810000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
    student_id: fixturePrefix + String(index + 1).padStart(12, '0'),
    label: index === 0 ? 'Directory scoped current' : 'Directory scoped other ' + (index + 1),
    enquiry_at: '2026-10-01T12:00:00Z', created_at: '2026-10-01T12:00:00Z',
  })));
  if (journeys.error) throw journeys.error;
  const historical = await db.from('onboarding_journeys').upsert({
    id: '48810000-0000-4000-8000-000000000206', student_id: fixturePrefix + '000000000001',
    label: 'Newer closed history', enquiry_at: '2026-10-15T12:00:00Z', created_at: '2026-10-15T12:00:00Z',
    closed_at: '2026-10-20T12:00:00Z', closure_reason: 'withdrawn', closed_evidence: frozenEvidence,
  });
  if (historical.error) throw historical.error;
  const family = await db.from('onboarding_journeys').upsert({
    id: '48810000-0000-4000-8000-000000000207', label: search + ' Family',
    enquiry_email: 'directory-boundary-family@altitutor.test', enquiry_at: '2026-10-01T12:00:00Z',
  });
  if (family.error) throw family.error;
  const preference = await db.from('onboarding_action_preferences').upsert({
    journey_id: '48810000-0000-4000-8000-000000000001', action_key: 'book_trial',
    due_at: '2999-01-01T12:00:00Z', assignee_id: '00000000-0000-0000-0000-000000000001',
  }, { onConflict: 'journey_id,action_key' });
  if (preference.error) throw preference.error;
  const returningStudents = await db.from('students').upsert([
    { id: '48820000-0000-4000-8000-000000000001', first_name: 'Directory returning boundary', last_name: 'Open', status: 'DISCONTINUED', registered_at: null },
    { id: '48820000-0000-4000-8000-000000000003', first_name: 'Directory returning boundary', last_name: 'Closed', status: 'DISCONTINUED', registered_at: null },
  ]);
  if (returningStudents.error) throw returningStudents.error;
  const returningJourneys = await db.from('onboarding_journeys').upsert([
    { id: '48820000-0000-4000-8000-000000000002', student_id: '48820000-0000-4000-8000-000000000001', label: 'Open returning enquiry', is_returning: true, enquiry_at: '2026-10-01T12:00:00Z' },
    { id: '48820000-0000-4000-8000-000000000004', student_id: '48820000-0000-4000-8000-000000000003', label: 'Closed returning enquiry', is_returning: true, enquiry_at: '2026-10-01T12:00:00Z', closed_at: '2026-10-20T12:00:00Z', closure_reason: 'withdrawn', closed_evidence: frozenEvidence },
  ]);
  if (returningJourneys.error) throw returningJourneys.error;
});

test.afterAll(async () => {
  const db = fixtureDatabase();
  const students = await ownedFixtureStudents(db);
  const ids = [...fixtureJourneyLabels.keys()];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const journeys = await db.from('onboarding_journeys').select('id,label').in('id', batch);
    if (journeys.error) throw journeys.error;
    if (journeys.data.some(journey => journey.label !== fixtureJourneyLabels.get(journey.id))) {
      throw new Error('Refusing to remove a journey outside the directory fixture ownership boundary');
    }
    const preferences = await db.from('onboarding_action_preferences').delete().in('journey_id', batch);
    if (preferences.error) throw preferences.error;
    const removed = await db.from('onboarding_journeys').delete().in('id', batch);
    if (removed.error) throw removed.error;
  }
  // Keep Student history and normal retirement guards, even in this disposable DB.
  const admin = await fixtureAdmin();
  for (const student of students) {
    const retired = await admin.rpc('retire_student', { p_student_id: student.id });
    if (retired.error) throw retired.error;
  }
});

test('Trial relationship includes a discontinued Student with an open returning journey before pagination', async ({ page }) => {
  await signIn(page);
  const input = { search: 'Directory returning boundary', filters: { relationship: ['trial'] }, sortBy: 'last_name', sortDirection: 'asc', page: 1, pageSize: 1 };
  const response = await page.request.post('/api/students/directory', { data: input });
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.total).toBe(1);
  expect(result.entries).toHaveLength(1);
  expect(result.entries[0]).toMatchObject({
    id: '48820000-0000-4000-8000-000000000001',
    student: { status: 'DISCONTINUED' },
    journey: { id: '48820000-0000-4000-8000-000000000002', is_returning: true },
  });
  const authoritative = await page.request.post('/api/students/directory', {
    data: { ...input, filters: { relationship: ['trial'], queue: ['open'] } },
  });
  expect(authoritative.status()).toBe(200);
  expect(await authoritative.json()).toEqual(result);
});

test('scoped onboarding reads return only requested journeys and retain caller authorization', async ({ request }) => {
  const url = process.env.ADMIN_E2E_SUPABASE_URL!;
  const key = process.env.ADMIN_E2E_PUBLIC_KEY!;
  const anonymous = await request.post(url + '/rest/v1/rpc/onboarding_journeys_scoped', {
    headers: { apikey: key }, data: { p_journey_ids: ['48810000-0000-4000-8000-000000000001'] },
  });
  expect(anonymous.status()).toBe(401);
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = await db.auth.signInWithPassword({ email: 'admin@altitutor.test', password: 'test-password' });
  if (admin.error) throw admin.error;
  const response = await request.post(url + '/rest/v1/rpc/onboarding_journeys_scoped', {
    headers: { apikey: key, Authorization: 'Bearer ' + admin.data.session.access_token },
    data: { p_journey_ids: ['48810000-0000-4000-8000-000000000001'] },
  });
  expect(response.status()).toBe(200);
  const rows = await response.json();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: '48810000-0000-4000-8000-000000000001', label: 'Directory scoped current', preferences: [{ action_key: 'book_trial', assignee_id: '00000000-0000-0000-0000-000000000001' }], evidence: { converted_at: null, trial_form_at: null } });
  const closed = await request.post(url + '/rest/v1/rpc/onboarding_journeys_scoped', {
    headers: { apikey: key, Authorization: 'Bearer ' + admin.data.session.access_token },
    data: { p_journey_ids: ['48810000-0000-4000-8000-000000000206'] },
  });
  expect((await closed.json())[0].evidence).toEqual(frozenEvidence);
  const tutor = await db.auth.signInWithPassword({ email: 'john.doe@altitutor.test', password: 'test-password' });
  if (tutor.error) throw tutor.error;
  const denied = await request.post(url + '/rest/v1/rpc/onboarding_journeys_scoped', {
    headers: { apikey: key, Authorization: 'Bearer ' + tutor.data.session.access_token },
    data: { p_journey_ids: ['48810000-0000-4000-8000-000000000001'] },
  });
  expect(denied.status()).toBe(200);
  expect(await denied.json()).toEqual([]);
});

test('page-scoped evidence matches authoritative global classification, including deadlines and family enquiries', async ({ page }) => {
  await signIn(page);
  const input = { search, filters: {}, sortBy: 'last_name', sortDirection: 'asc', page: 1, pageSize: 2 };
  const ordinary = await page.request.post('/api/students/directory', { data: input });
  expect(ordinary.status()).toBe(200);
  const current = await ordinary.json();
  const global = await page.request.post('/api/students/directory', { data: {
    ...input, filters: { onboardingStatus: ['Enquiry', 'Trial booked', 'Trial attended', 'Registration', 'Registered', 'Classes added', 'Converted', 'No onboarding'] },
  } });
  expect(global.status()).toBe(200);
  expect(await global.json()).toEqual(current);
  expect(current.entries[0]).toMatchObject({
    journey: { id: '48810000-0000-4000-8000-000000000001' }, stage: 'Enquiry',
    actions: [{ key: 'book_trial', waiting: false, overdue: false, assigneeId: '00000000-0000-0000-0000-000000000001' }],
  });
  const overdue = await page.request.post('/api/students/directory', { data: {
    ...input, filters: { relationship: ['in_person'], queue: ['overdue'] },
  } });
  const overduePage = await overdue.json();
  expect(overduePage.total).toBe(204);
  expect(overduePage.entries[0].label).toBe(search + ' 002');
  const family = await page.request.post('/api/students/directory', { data: {
    ...input, search: search + ' Family',
  } });
  expect((await family.json()).entries[0]).toMatchObject({
    kind: 'enquiry', label: search + ' Family', journey: { id: '48810000-0000-4000-8000-000000000207' }, stage: 'Enquiry',
  });
});

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@altitutor.test');
  await page.getByPlaceholder('Enter your password').fill('test-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/|\?|$)/, { timeout: 30_000 });
}

test('a Board refresh loads all matching Students once while table pages stay bounded', async ({ page }) => {
  await signIn(page);
  const input = {
    search, filters: { relationship: ['in_person'] },
    sortBy: 'last_name', sortDirection: 'asc', page: 1, pageSize: 200,
  };
  const table = await page.request.post('/api/students/directory', { data: input });
  expect(table.status()).toBe(200);
  const tablePage = await table.json();
  expect(tablePage.total).toBe(205);
  expect(tablePage.entries).toHaveLength(200);

  const board = await page.request.post('/api/students/directory', {
    data: { ...input, allPages: true },
  });
  expect(board.status()).toBe(200);
  const boardPage = await board.json();
  expect(boardPage.total).toBe(205);
  expect(boardPage.entries).toHaveLength(205);
  expect(boardPage.entries[0].label).toBe(search + ' 001');
  expect(boardPage.entries[204].label).toBe(search + ' 205');
});

test('large Board output stays complete and a cancelled read can be retried', async ({ page }) => {
  const db = createClient<Database>(process.env.ADMIN_E2E_SUPABASE_URL!, process.env.ADMIN_E2E_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ids = Array.from({ length: 205 }, (_, index) => fixturePrefix + String(index + 1).padStart(12, '0'));
  const progress = { fixture: 'x'.repeat(25_000) };
  const setProgress = async (value: typeof progress | Record<string, never>) => {
    for (let offset = 0; offset < ids.length; offset += 100) {
      const result = await db.from('students').update({ onboarding_progress: value }).in('id', ids.slice(offset, offset + 100));
      if (result.error) throw result.error;
    }
  };
  await setProgress(progress);
  try {
    await signIn(page);
    const input = { search, filters: { relationship: ['in_person'] }, sortBy: 'last_name', sortDirection: 'asc', page: 1, pageSize: 200, allPages: true };
    const cancelled = await page.evaluate(async (body) => {
      const abort = new AbortController();
      const response = await fetch('/api/students/directory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: abort.signal,
      });
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Missing Board response stream');
      await reader.read();
      abort.abort();
      try {
        while (!(await reader.read()).done) { /* Drain until cancellation is observed. */ }
        return false;
      } catch (error) {
        return error instanceof DOMException && error.name === 'AbortError';
      }
    }, input);
    expect(cancelled).toBe(true);
    const complete = await page.evaluate(async (body) => {
      const response = await fetch('/api/students/directory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const text = await response.text();
      const data = JSON.parse(text) as { total: number; entries: Array<{ label: string }> };
      return { status: response.status, bytes: new TextEncoder().encode(text).byteLength,
        total: data.total, count: data.entries.length, last: data.entries.at(-1)?.label };
    }, input);
    expect(complete).toMatchObject({ status: 200, total: 205, count: 205, last: search + ' 205' });
    expect(complete.bytes).toBeGreaterThan(5_000_000);
  } finally {
    await setProgress({});
  }
});
