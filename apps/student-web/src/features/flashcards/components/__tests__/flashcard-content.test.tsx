import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FlashcardReviewCard } from '@altitutor/shared';
import { FlashcardReviewSession } from '../flashcard-review-session';

const imagePath = '00000000-0000-4000-8000-000000000001/equation.png';
const card: FlashcardReviewCard = {
  id: 'review-1', flashcard_id: 'flashcard-1', cloze_index: 1, topic_id: 'topic-1',
  card_type: 'text_cloze',
  cloze_text: `<div>Recall {{c1::first line\nsecond line::two lines}}</div><div>Equation {{c2::<img alt="Equation answer" src="" data-storage-bucket="flashcard-images" data-storage-path="${imagePath}">}}</div>`,
  extra: '<div>Useful context</div>', image_file_id: null, image_alt_text: null,
  image_storage_path: null, image_mimetype: null, occlusion_data: null, flashcard_index: 0,
  due_at: '2026-10-29T00:00:00Z', stability: null, difficulty: null, scheduled_days: 0,
  learning_steps: 0, reps: 0, lapses: 0, state: 'New', last_reviewed_at: null,
  last_rating: null, revision: 0, buried_until: null, buried_reason: null, suspended_at: null, leech_at: null,
};

beforeAll(() => {
  Object.assign(global, { React });
});

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ data: { signedUrls: ['https://example.test/equation.png'] } }),
  } as Response));
});

it.each([1, 2])('preserves blocks, hints and images while hiding only cloze %i', async (clozeIndex) => {
  const path = imagePath.replace('equation.png', `equation-${clozeIndex}.png`);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <FlashcardReviewSession topicId="topic-1" mode="all" cards={[{
        ...card, cloze_index: clozeIndex, cloze_text: card.cloze_text?.replace(imagePath, path) ?? '',
      }]} />
    </QueryClientProvider>,
  );

  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/flashcards/images/signed-urls', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: [path] }),
  }));
  expect(container.querySelector('.prose')?.children).toHaveLength(2);
  expect(container.textContent).not.toContain('{{c');
  expect(screen.queryByText('Useful context')).not.toBeInTheDocument();
  if (clozeIndex === 1) {
    expect(screen.getByText('... (two lines)')).toBeVisible();
    expect(container.textContent).not.toContain('first line');
    await waitFor(() => expect(screen.getByRole('img', { name: 'Equation answer' })).toHaveAttribute('src', 'https://example.test/equation.png'));
  } else {
    expect(container.textContent).toContain('first line\nsecond line');
    expect(screen.queryByRole('img', { name: 'Equation answer' })).not.toBeInTheDocument();
  }

  fireEvent.click(screen.getByRole('button', { name: /Show answer/ }));
  expect(container.textContent).toContain('first line\nsecond line');
  expect(container.textContent).not.toContain('two lines');
  await waitFor(() => expect(screen.getByRole('img', { name: 'Equation answer' })).toHaveAttribute('src', 'https://example.test/equation.png'));
  expect(screen.getByText('Useful context')).toBeVisible();
});
