import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FlashcardSettingsPage } from '../flashcard-settings-page';

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
const json = (data: unknown) => ({ ok: true, json: async () => ({ data }) }) as Response;

beforeAll(() => {
  Object.assign(global, { React });
  global.fetch = fetchMock;
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => String(url).includes('/preferences')
    ? json({ new_cards_per_study_day: 20, review_cards_per_study_day: 200, timezone: 'Australia/Adelaide', pending_timezone: null })
    : json([{ id: 'preset-1', name: 'Default', defaultRetention: 0.9, desiredRetention: null, optimizedAt: null }]));
});

it('offers one save bar for changed settings, cancels drafts, and saves only changed sections', async () => {
  render(<FlashcardSettingsPage />);
  const limit = await screen.findByLabelText('New cards per study day');
  await waitFor(() => expect(limit).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();

  fireEvent.change(limit, { target: { value: '25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(limit).toHaveValue(20);
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Default desired retention'), { target: { value: '0.92' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument());
  const writes = fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT');
  expect(writes.map(([url]) => url)).toEqual(['/api/flashcards/presets']);
  expect(JSON.parse(writes[0][1]!.body as string)).toEqual({ presetId: 'preset-1', desiredRetention: 0.92 });
});

it('keeps a failed retention draft and retains successful study settings when canceling after a partial save', async () => {
  const getSettings = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url, options) => {
    if (options?.method !== 'PUT') return getSettings(url, options);
    return String(url).includes('/preferences') ? json({ pending_timezone: null }) : { ok: false } as Response;
  });
  render(<FlashcardSettingsPage />);
  const limit = await screen.findByLabelText('New cards per study day');
  await waitFor(() => expect(limit).toBeEnabled());
  const target = screen.getByLabelText('Default desired retention');
  fireEvent.change(limit, { target: { value: '25' } });
  fireEvent.change(target, { target: { value: '0.92' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByRole('alert');
  expect(target).toHaveValue(0.92);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(limit).toHaveValue(25);
  expect(target).toHaveValue(0.9);
  expect(screen.queryByRole('region', { name: 'Unsaved settings' })).not.toBeInTheDocument();
});
