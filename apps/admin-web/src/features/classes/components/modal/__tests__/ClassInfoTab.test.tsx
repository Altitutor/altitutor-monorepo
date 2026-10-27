import React from 'react';
import { randomUUID } from 'node:crypto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import { ClassInfoTab } from '../tabs/ClassInfoTab';

const mockRpc = jest.fn(async (_name: string, _args: Record<string, unknown>) => ({
  data: { proposal_hash: 'checked-proposal', counts: { create: 0, update: 0, delete: 0, cancel: 0, preserve: 0, protected: 0 }, occurrences: [], removals: [], conflicts: [] },
  error: null,
}));
const mockFrom = jest.fn(() => {
  const query = {
    select() { return query; },
    eq() { return query; },
    is() { return query; },
    gte() { return query; },
    order() { return query; },
    then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };
  return query;
});
jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));
const subject = { id: 'subject-maths', long_name: 'Mathematics', name: 'Maths' } as Tables<'subjects'>;
const fixture = {
  id: 'class-one', subject_id: subject.id, session_type: 'CLASS',
  billing_type: 'CLASS', status: 'ACTIVE', cohort_label: 'A',
  day_of_week: 1, start_time: '16:00:00', end_time: '17:30:00',
  room: 'Room 1', session_start_date: '2026-01-01', session_end_date: '2099-12-31',
} as Tables<'classes'>;

function openEditor(classData: Tables<'classes'> = fixture) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ClassInfoTab
    classData={classData} subjects={[subject]} isEditing isLoading={false}
    onEdit={() => undefined} onCancelEdit={() => undefined} onSaved={() => undefined}
  /></QueryClientProvider>);
  return userEvent.setup();
}
beforeAll(() => {
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID });
  Object.defineProperty(global, 'ResizeObserver', { configurable: true, value: class { observe() {} unobserve() {} disconnect() {} } });
  Element.prototype.scrollIntoView = jest.fn();
});
beforeEach(() => {
  mockRpc.mockClear();
  mockFrom.mockClear();
});
it('retains the stored Subject and legacy timetable when the loaded revision timeline is empty', async () => {
  const user = openEditor();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add day / time' })).toBeEnabled());
  expect(await screen.findByText('Mathematics')).toBeInTheDocument();
  expect(screen.getByDisplayValue('16:00:00')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Review changes' }));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('preview_class_schedule', {
    p_proposal: expect.objectContaining({ subject_id: subject.id, session_type: 'CLASS' }),
  }));
});


it('blocks subjectless Class preview with the existing actionable Subject message', async () => {
  const user = openEditor({ ...fixture, subject_id: null });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review changes' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Review changes' }));
  expect(await screen.findByText('A subject is required for a Class.')).toBeInTheDocument();
  expect(mockRpc).not.toHaveBeenCalled();
});

it('permits subject-independent Homework Help with an empty loaded timeline', async () => {
  const user = openEditor({ ...fixture, session_type: 'HOMEWORK_HELP', subject_id: null, billing_type: null });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review changes' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Review changes' }));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('preview_class_schedule', {
    p_proposal: expect.objectContaining({ subject_id: null, session_type: 'HOMEWORK_HELP', billing_type: null }),
  }));
});

it('permits preview after the administrator supplies the missing Subject', async () => {
  const user = openEditor({ ...fixture, subject_id: null });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review changes' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Review changes' }));
  expect(await screen.findByText('A subject is required for a Class.')).toBeInTheDocument();
  await user.click(screen.getByText('Select subject'));
  await user.click(await screen.findByText('Mathematics'));
  await user.click(screen.getByRole('button', { name: 'Review changes' }));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('preview_class_schedule', {
    p_proposal: expect.objectContaining({ subject_id: subject.id }),
  }));
});
