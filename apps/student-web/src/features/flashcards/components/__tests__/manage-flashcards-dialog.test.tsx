import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FlashcardReviewCard } from '@altitutor/shared';
import { ManageFlashcardsDialog } from '../manage-flashcards-dialog';

const card: FlashcardReviewCard = {
  id: 'review-1', flashcard_id: 'flashcard-1', cloze_index: 1, topic_id: 'topic-1',
  card_type: 'text_cloze', cloze_text: 'Water is {{c1::H2O}}.', extra: null,
  image_file_id: null, image_alt_text: null, image_storage_path: null,
  image_mimetype: null, occlusion_data: null, flashcard_index: 0,
  due_at: '2026-10-29T00:00:00Z', stability: null, difficulty: null,
  scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 'New',
  last_reviewed_at: null, last_rating: null, revision: 0, buried_until: null,
  buried_reason: null, suspended_at: null, leech_at: null,
};

const json = (data: unknown) => ({ ok: true, json: async () => ({ data }) }) as Response;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

beforeAll(() => {
  Object.assign(global, { React });
  window.matchMedia = jest.fn().mockImplementation((media: string) => ({
    matches: false, media, addEventListener() {}, removeEventListener() {},
  }));
  global.fetch = fetchMock;
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => 'request-1' });
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => fetchMock.mockReset());

it('shows a saved suspension and its history without downloading the catalog again', async () => {
  let catalogRequests = 0;
  const historyEntry = {
    id: 'history-1', review_card_id: card.id, action: 'suspend', rating: null,
    answered_at: '2026-10-29T08:00:00Z', duration_ms: null,
    pre_state: { state: 'New', revision: 0 },
    post_state: { state: 'New', revision: 1, suspended_at: '2026-10-29T08:00:00Z' },
    undone_at: null,
  };
  fetchMock.mockImplementation(async (url, options) => {
    if (options?.method === 'POST') return json({ cardState: { ...card, suspended_at: '2026-10-29T08:00:00Z', revision: 1 }, historyEntry });
    if (String(url).includes('/history')) return json([]);
    catalogRequests += 1;
    // A save must work even when a second full catalog transfer is unavailable.
    return catalogRequests === 1 ? json([card]) : { ok: false } as Response;
  });

  render(<ManageFlashcardsDialog open onOpenChange={() => undefined} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/· suspend/)).toBeVisible();
  expect(catalogRequests).toBe(1);
});

it('keeps successful unbury results when another card fails and offers a targeted retry', async () => {
  const first = { ...card, buried_until: '2026-10-30T00:00:00Z' };
  const second = { ...first, id: 'review-2', flashcard_id: 'flashcard-2', cloze_text: 'Salt is {{c1::NaCl}}.' };
  const unburied: string[] = [];
  let failSecond = true;
  fetchMock.mockImplementation(async (url, options) => {
    if (options?.method === 'POST') {
      const current = String(url).includes('review-2') ? second : first;
      if (current === second && failSecond) return { ok: false } as Response;
      unburied.push(current.id);
      return json({ cardState: { ...current, buried_until: null }, historyEntry: {
        id: `history-${current.id}`, review_card_id: current.id, action: 'unbury', rating: null,
        answered_at: '2026-10-29T08:00:00Z', duration_ms: null,
        pre_state: { state: 'New' }, post_state: { state: 'New' }, undone_at: null,
      } });
    }
    return String(url).includes('/history') ? json([]) : json([first, second]);
  });
  render(<ManageFlashcardsDialog open onOpenChange={() => undefined} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Unbury all' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Some cards could not be confirmed as unburied');
  expect(screen.getByRole('button', { name: 'Bury' })).toBeEnabled();
  failSecond = false;
  fireEvent.click(screen.getByRole('button', { name: 'Unbury all' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Unbury all' })).not.toBeInTheDocument());
  expect(unburied).toEqual(['review-1', 'review-2']);
});

it('retries a committed change with the original command ID when its state could not be loaded', async () => {
  const requestIds: string[] = [];
  let uuid = 0;
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => `request-${++uuid}` });
  fetchMock.mockImplementation(async (url, options) => {
    if (options?.method === 'POST') {
      requestIds.push(JSON.parse(options.body as string).requestId);
      return requestIds.length === 1 ? json({ revision: 1, reviewLogId: 'log-1' }) : json({
        cardState: { ...card, suspended_at: '2026-10-29T08:00:00Z', revision: 1 },
        historyEntry: { id: 'log-1', review_card_id: card.id, action: 'suspend', rating: null,
          answered_at: '2026-10-29T08:00:00Z', duration_ms: null,
          pre_state: { state: 'New' }, post_state: { state: 'New' }, undone_at: null },
      });
    }
    return String(url).includes('/history') ? json([]) : json([card]);
  });
  render(<ManageFlashcardsDialog open onOpenChange={() => undefined} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('saved');
  fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
  await screen.findByRole('button', { name: 'Resume' });
  expect(requestIds).toEqual(['request-1', 'request-1']);
});
