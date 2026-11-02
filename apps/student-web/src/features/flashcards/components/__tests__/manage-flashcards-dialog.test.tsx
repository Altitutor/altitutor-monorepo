import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FlashcardReviewCard } from '@altitutor/shared';
import { ManageFlashcardsDialog } from '../manage-flashcards-dialog';

jest.mock('@/features/resources/api/resources', () => ({
  resourcesApi: { getMySubjects: jest.fn(async () => [
    { id: 'subject-1', name: 'Biology', short_name: 'BIO', color: 'aabbcc' },
    { id: 'subject-2', name: 'Chemistry', short_name: 'CHEM', color: 'ccbbaa' },
    { id: 'subject-3', name: 'Physics', short_name: 'PHY', color: null },
  ]) },
}));

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
  HTMLElement.prototype.scrollIntoView = jest.fn();
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
  const first = { ...card, buried_until: '2099-10-30T00:00:00Z' };
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

it('explains mixed sibling states and includes suspended and buried clozes in the row', async () => {
  fetchMock.mockImplementation(async (url) => String(url).includes('/history') ? json([]) : json([
    { ...card, suspended_at: '2026-10-29T00:00:00Z' },
    { ...card, id: 'review-2', cloze_index: 2, state: 'Review', buried_until: '2099-01-01T00:00:00Z' },
  ]));
  render(<ManageFlashcardsDialog open onOpenChange={() => undefined} />);
  const row = await screen.findByRole('row', { name: /Water is H2O/ });
  expect(within(row).getByText('Mixed')).toBeVisible();
  expect(within(row).getByText('New 1 · Review 1')).toBeVisible();
  expect(within(row).getByText('Suspended 1')).toBeVisible();
  expect(within(row).getByText('Buried 1')).toBeVisible();
  expect(within(row).getByText('Mixed')).toHaveClass('bg-muted/60');
  expect(screen.getByText(/Each cloze has one study state/)).toBeVisible();
});

it('pages complete flashcard groups and applies fixed subject views across all pages', async () => {
  const cards = Array.from({ length: 21 }, (_, index) => ({
    ...card, id: `review-${index}`, flashcard_id: `flashcard-${index}`, flashcard_index: index,
    cloze_text: `Question ${index}`, subject_id: index === 20 ? 'subject-2' : 'subject-1',
    subject_short_name: index === 20 ? 'CHEM' : 'BIO',
  }));
  fetchMock.mockImplementation(async (url) => String(url).includes('/history') ? json([]) : json(cards));
  render(<ManageFlashcardsDialog open onOpenChange={() => undefined} />);
  const list = within(screen.getByRole('region', { name: 'Flashcard list' }));
  expect(await list.findByRole('button', { name: 'All flashcards' })).toHaveAttribute('aria-pressed', 'true');
  await list.findByText('Question 0');
  expect(list.getAllByRole('row')).toHaveLength(21); // Header + 20 flashcard groups.
  expect(list.queryByText('Question 20')).not.toBeInTheDocument();
  fireEvent.click(list.getByRole('button', { name: 'Next page' }));
  expect(await list.findByText('Question 20')).toBeVisible();
  fireEvent.click(list.getByRole('button', { name: 'BIO' }));
  expect(await list.findByText('Question 0')).toBeVisible();
  expect(list.queryByText('Question 20')).not.toBeInTheDocument();
  fireEvent.click(list.getByRole('button', { name: 'CHEM' }));
  expect(await list.findByText('Question 20')).toBeVisible();
  expect(list.getAllByRole('row')).toHaveLength(2);
  fireEvent.click(list.getByRole('button', { name: 'PHY' }));
  expect(list.getByText('No flashcards match these filters.')).toBeVisible();
  fireEvent.click(list.getByRole('button', { name: 'All flashcards' }));
  expect(await list.findByText('Question 0')).toBeVisible();
  expect(screen.queryByRole('button', { name: /edit view|save view|add view/i })).not.toBeInTheDocument();
});

it('shows subject, topic, retention range and total reviews when their display properties are enabled', async () => {
  fetchMock.mockImplementation(async (url) => String(url).includes('/history') ? json([]) : json([
    { ...card, subject_id: 'subject-1', subject_short_name: 'BIO', topic_code: 'B1', topic_name: 'Cells', state: 'Review', retrievability: 0.85, reps: 4 },
    { ...card, id: 'review-2', cloze_index: 2, subject_id: 'subject-1', subject_short_name: 'BIO', topic_code: 'B1', topic_name: 'Cells', state: 'Review', retrievability: 0.95, reps: 2 },
  ]));
  render(<ManageFlashcardsDialog open onOpenChange={() => undefined} />);
  await screen.findByRole('row', { name: /Water is H2O/ });
  fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
  const display = screen.getByRole('dialog', { name: 'Display options' });
  for (const name of ['Subject', 'Topic', 'Retention', 'Number of reviews']) {
    fireEvent.click(within(display).getByRole('button', { name }));
  }
  const row = screen.getByRole('row', { name: /Water is H2O/ });
  expect(within(row).getByText('BIO')).toHaveStyle({ backgroundColor: '#aabbcc' });
  expect(within(row).getByText('B1 · Cells')).toBeVisible();
  expect(within(row).getByText('85–95%')).toBeVisible();
  expect(within(row).getByText('6')).toBeVisible();
});

it('combines subject and topic filters across the complete collection', async () => {
  const user = userEvent.setup();
  fetchMock.mockImplementation(async (url) => String(url).includes('/history') ? json([]) : json([
    { ...card, subject_id: 'subject-1', topic_code: 'B1', topic_name: 'Cells', cloze_text: 'Cells question' },
    { ...card, id: 'review-2', flashcard_id: 'flashcard-2', topic_id: 'topic-2', subject_id: 'subject-1', topic_code: 'B2', topic_name: 'Genetics', cloze_text: 'Genetics question' },
    { ...card, id: 'review-3', flashcard_id: 'flashcard-3', topic_id: 'topic-3', subject_id: 'subject-2', topic_code: 'C1', topic_name: 'Atoms', cloze_text: 'Atoms question' },
  ]));
  render(<ManageFlashcardsDialog open onOpenChange={() => undefined} />);
  await screen.findByRole('row', { name: /Cells question/ });
  await user.click(screen.getByRole('button', { name: 'Display options' }));
  await user.click(screen.getByRole('button', { name: 'Add filter' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Subject' }));
  await user.click(await screen.findByRole('option', { name: 'Biology' }));
  await user.keyboard('{Escape}{Escape}');
  expect(screen.getAllByRole('row')).toHaveLength(3);
  expect(screen.queryByRole('row', { name: /Atoms question/ })).not.toBeInTheDocument();
  if (!screen.queryByRole('dialog', { name: 'Display options' })) await user.click(screen.getByRole('button', { name: 'Display options' }));
  await user.click(screen.getByRole('button', { name: 'Add filter' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Topic' }));
  await user.click(await screen.findByRole('option', { name: 'B2 · Genetics' }));
  await user.keyboard('{Escape}{Escape}');
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getByRole('row', { name: /Genetics question/ })).toBeVisible();
});
