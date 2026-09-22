import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FlashcardReviewCard, ImageOcclusionData } from '@altitutor/shared';
import { FlashcardReviewSession } from '../flashcard-review-session';

type MockButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: string;
  size?: string;
};

jest.mock('@altitutor/ui', () => ({
  createStoredImageHtmlRenderer: () => ({
    refresh: async (html: string | null | undefined) => html ?? '',
    preload: async () => undefined,
    clearCache: () => undefined,
  }),
  Button: ({ children, asChild, variant: _variant, size: _size, ...props }: MockButtonProps) =>
    asChild ? <>{children}</> : <button {...props}>{children}</button>,
  ImageOcclusionViewer: ({ imageUrl, alt, onLoad, onError }: {
    imageUrl: string;
    alt: string;
    onLoad?: () => void;
    onError?: () => void;
  }) => (
    // The mock intentionally exposes the native image lifecycle under test.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt={alt} onLoad={onLoad} onError={onError} />
  ),
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const mockRateReviewCard = jest.fn();
jest.mock('../../hooks/useFlashcards', () => ({
  useRateFlashcardReviewCard: () => ({ mutateAsync: mockRateReviewCard }),
}));

const occlusionData: ImageOcclusionData = {
  version: 1,
  naturalWidth: 1000,
  naturalHeight: 800,
  masks: [
    { id: 'one', clozeIndex: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    { id: 'two', clozeIndex: 2, x: 0.4, y: 0.1, width: 0.2, height: 0.2 },
  ],
};

function imageReviewCard(id: string, clozeIndex: number): FlashcardReviewCard {
  return {
    id,
    flashcard_id: 'flashcard-1',
    cloze_index: clozeIndex,
    topic_id: 'topic-1',
    card_type: 'image_occlusion',
    cloze_text: null,
    extra: null,
    image_file_id: 'file-1',
    image_alt_text: 'Labelled diagram',
    image_storage_path: 'topic-1/diagram.png',
    image_mimetype: 'image/png',
    image_url: 'https://example.test/diagram.png?token=signed',
    occlusion_data: occlusionData,
    flashcard_index: 1,
    due_at: new Date(0).toISOString(),
    stability: null,
    difficulty: null,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 'New',
    last_reviewed_at: null,
    last_rating: null,
    revision: 0,
    buried_until: null,
    buried_reason: null,
    suspended_at: null,
    leech_at: null,
  };
}

function textReviewCard(id: string, label: string): FlashcardReviewCard {
  return {
    ...imageReviewCard(id, 1),
    flashcard_id: `flashcard-${id}`,
    card_type: 'text_cloze',
    cloze_text: `${label}: {{c1::answer}}`,
    image_file_id: null,
    image_alt_text: null,
    image_storage_path: null,
    image_mimetype: null,
    image_url: null,
    occlusion_data: null,
  };
}

describe('FlashcardReviewSession', () => {
  beforeAll(() => {
    Object.defineProperty(global.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => '00000000-0000-4000-8000-000000000001'),
    });
  });

  beforeEach(()=>mockRateReviewCard.mockReset());
  it('remounts the source image when moving between clozes on the same flashcard', async () => {
    render(
      <FlashcardReviewSession
        topicId="topic-1"
        mode="all"
        cards={[imageReviewCard('review-1', 1), imageReviewCard('review-2', 2)]}
      />,
    );

    const firstImage = screen.getByRole('img', { name: 'Labelled diagram' });
    fireEvent.load(firstImage);

    act(() => fireEvent.keyDown(document.body, { code: 'Space' }));
    act(() => fireEvent.keyDown(document.body, { code: 'Space' }));

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Labelled diagram' })).not.toBe(firstImage);
    });

    fireEvent.load(screen.getByRole('img', { name: 'Labelled diagram' }));
    expect(screen.queryByText('Loading image…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show answer/ })).toBeEnabled();
  });

  it('rolls the exact card back after a failed answer and retries with the same idempotency key', async()=>{
    const card=imageReviewCard('review-1',1);mockRateReviewCard.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(card);
    render(<FlashcardReviewSession topicId="topic-1" mode="due" cards={[card]}/>);fireEvent.load(screen.getByRole('img',{name:'Labelled diagram'}));
    fireEvent.click(screen.getByRole('button',{name:/Show answer/}));fireEvent.click(screen.getByRole('button',{name:/Good/}));
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Your answer was not saved. Please try again.'));
    expect(screen.getByRole('button',{name:/Good/})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:/Good/}));
    await waitFor(()=>expect(mockRateReviewCard).toHaveBeenCalledTimes(2));expect(mockRateReviewCard.mock.calls[1][0].requestId).toBe(mockRateReviewCard.mock.calls[0][0].requestId);
    await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('pins answer controls with undo and bury and shows note and solution links after revealing the answer', async () => {
    const card = imageReviewCard('review-1', 1);
    card.note_links = [
      { id: 'notes-1', label: '1.1N · Cell notes', href: '/resources/12biol/1.1/1.1n', is_solution: false },
      { id: 'notes-2', label: '1.1N.S · Cell notes solutions', href: '/resources/12biol/1.1/1.1n.s', is_solution: true },
    ];

    render(<FlashcardReviewSession topicId="topic-1" mode="due" cards={[card]} />);
    fireEvent.load(screen.getByRole('img', { name: 'Labelled diagram' }));
    await act(async () => {
      await Promise.resolve();
    });

    const controls = screen.getByTestId('flashcard-answer-controls');
    expect(controls.tagName).toBe('FOOTER');
    expect(controls).not.toHaveClass('sticky');
    expect(screen.getByRole('button', { name: /Show answer/ })).not.toHaveClass('w-full');
    expect(screen.getByRole('button', { name: /Undo/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Bury/ })).toBeVisible();
    expect(screen.getByText('1 new')).toBeVisible();
    expect(screen.getByText('0 learning')).toBeVisible();
    expect(screen.getByText('0 review')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }));

    expect(screen.getByRole('heading', { name: 'Notes and solutions' })).toBeVisible();
    expect(screen.getByRole('link', { name: /1.1N · Cell notes/ })).toHaveAttribute('href', '/resources/12biol/1.1/1.1n');
    expect(screen.getByRole('link', { name: /Solution: 1.1N.S/ })).toHaveAttribute('href', '/resources/12biol/1.1/1.1n.s');
  });

  it('advances to the next card immediately while its rating is being saved', async () => {
    const first = textReviewCard('review-1', 'First');
    const second = textReviewCard('review-2', 'Second');
    mockRateReviewCard.mockImplementation(() => new Promise(() => undefined));

    render(<FlashcardReviewSession topicId="topic-1" mode="due" cards={[first, second]} />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }));
    fireEvent.click(screen.getByRole('button', { name: /Good/ }));

    await waitFor(() => expect(screen.getByText(/Second/)).toBeVisible());
    expect(screen.queryByText(/First/)).not.toBeInTheDocument();
  });

  it('restores an undone card from the authoritative due snapshot', async () => {
    const first = textReviewCard('review-1', 'First');
    const second = textReviewCard('review-2', 'Second');
    mockRateReviewCard.mockResolvedValue({
      ...first,
      due_at: '2100-01-01T00:00:00.000Z',
      state: 'Review',
      revision: 1,
    });
    const { rerender } = render(
      <FlashcardReviewSession topicId="topic-1" mode="due" cards={[first, second]} queueRevision={0} />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }));
    fireEvent.click(screen.getByRole('button', { name: /Good/ }));
    await waitFor(() => expect(screen.getByText(/Second/)).toBeVisible());

    rerender(
      <FlashcardReviewSession topicId="topic-1" mode="due" cards={[first, second]} queueRevision={1} />,
    );

    await waitFor(() => expect(screen.getByText(/First/)).toBeVisible());
  });

  it('returns the committed answer receipt needed for a bounded undo', async () => {
    const card = textReviewCard('review-1', 'First');
    const onAnswerCommitted = jest.fn();
    mockRateReviewCard.mockResolvedValue({
      ...card,
      due_at: '2100-01-01T00:00:00.000Z',
      state: 'Review',
      revision: 1,
      answer_log_id: 'fa100000-0000-4000-8000-000000000008',
    });

    render(
      <FlashcardReviewSession
        topicId="topic-1"
        mode="due"
        cards={[card]}
        onAnswerCommitted={onAnswerCommitted}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }));
    fireEvent.click(screen.getByRole('button', { name: /Good/ }));

    await waitFor(() => {
      expect(onAnswerCommitted).toHaveBeenCalledWith('fa100000-0000-4000-8000-000000000008');
    });
  });

  it('removes buried siblings from the remaining queue', async () => {
    const first = textReviewCard('review-1', 'First');
    const sibling = { ...textReviewCard('review-2', 'Sibling'), flashcard_id: first.flashcard_id };
    const other = textReviewCard('review-3', 'Other');
    mockRateReviewCard.mockResolvedValue({
      ...first,
      due_at: '2100-01-01T00:00:00.000Z',
      state: 'Review',
      revision: 1,
      buried_sibling_ids: [sibling.id],
    });

    render(<FlashcardReviewSession topicId="topic-1" mode="due" cards={[first, sibling, other]} />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }));
    fireEvent.click(screen.getByRole('button', { name: /Good/ }));

    await waitFor(() => expect(screen.getByText(/Other/)).toBeVisible());
    expect(screen.queryByText(/Sibling/)).not.toBeInTheDocument();
  });

  it('shows a learning card next, behind the card already on screen, even when the step is longer than an hour', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-22T01:00:00.000Z'));
    const first = textReviewCard('review-1', 'First');
    const second = textReviewCard('review-2', 'Second');
    const third = textReviewCard('review-3', 'Third');
    const studyDayEndsAt = '2026-09-22T08:00:00.000Z';
    mockRateReviewCard
      .mockResolvedValueOnce({
        ...first,
        state: 'Learning',
        due_at: '2026-09-22T03:00:00.000Z',
        study_day_ends_at: studyDayEndsAt,
        revision: 1,
      })
      .mockResolvedValueOnce({
        ...second,
        state: 'Review',
        due_at: '2026-09-23T01:00:00.000Z',
        study_day_ends_at: studyDayEndsAt,
        revision: 1,
      });

    try {
      render(<FlashcardReviewSession topicId="topic-1" mode="due" cards={[first, second, third]} />);
      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.click(screen.getByRole('button', { name: /Show answer/ }));
      fireEvent.click(screen.getByRole('button', { name: /Good/ }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText(/Second/)).toBeVisible();

      await act(async () => {
        jest.advanceTimersByTime(2 * 60 * 60 * 1000);
      });

      expect(screen.getByText(/Second/)).toBeVisible();
      expect(screen.queryByText(/First/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Show answer/ }));
      fireEvent.click(screen.getByRole('button', { name: /Good/ }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText(/First/)).toBeVisible();
      expect(screen.queryByText(/Third/)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('counts relearning cards as learning and explains each status on hover', async () => {
    const fresh = textReviewCard('review-1', 'Fresh');
    const learning = { ...textReviewCard('review-2', 'Learning'), state: 'Learning' as const };
    const relearning = { ...textReviewCard('review-3', 'Relearning'), state: 'Relearning' as const };
    const review = { ...textReviewCard('review-4', 'Review'), state: 'Review' as const };

    render(<FlashcardReviewSession topicId="topic-1" mode="due" cards={[fresh, learning, relearning, review]} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('1 new')).toBeVisible();
    expect(screen.getByText('2 learning')).toBeVisible();
    expect(screen.getByText('1 review')).toBeVisible();
    expect(screen.queryByText('1 relearning')).not.toBeInTheDocument();
    expect(screen.getByTestId('flashcard-answer-controls')).toHaveTextContent('Cards you have not studied before.');
    expect(screen.getByTestId('flashcard-answer-controls')).toHaveTextContent('Cards in learning or relearning');
    expect(screen.getByTestId('flashcard-answer-controls')).toHaveTextContent('Cards you have learned that are due for review.');
  });

  it('shows cards held by today when the due queue is empty', () => {
    render(
      <FlashcardReviewSession
        topicId="due-all"
        mode="due"
        cards={[]}
        queueHold={{
          newLimit: 4,
          reviewLimit: 2,
          newBlockedByReviews: 1,
          futureLearning: 3,
          nextDueAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No cards due' })).toBeVisible();
    expect(screen.getByText("4 new cards are held by today's limit.")).toBeVisible();
    expect(screen.getByText("2 review cards are held by today's limit.")).toBeVisible();
    expect(screen.getByText('1 new card waits until overdue reviews are cleared.')).toBeVisible();
    expect(screen.getByText(/3 learning cards are not due yet/)).toBeVisible();
    expect(screen.getByText('0 new')).toBeVisible();
  });

  it('undoes with Z and buries the current card with minus', async () => {
    const first = textReviewCard('review-1', 'First');
    const second = textReviewCard('review-2', 'Second');
    const onUndo = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    render(
      <FlashcardReviewSession
        topicId="topic-1"
        mode="due"
        cards={[first, second]}
        onUndo={onUndo}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });
    expect(onUndo).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'z' });
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document.body, { key: '-' });
    await waitFor(() => expect(screen.getByText(/Second/)).toBeVisible());
    expect(screen.queryByText(/First/)).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/flashcards/review-cards/review-1/manage',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = (global.fetch as jest.Mock).mock.calls[0][1] as { body: string };
    expect(JSON.parse(request.body)).toEqual(expect.objectContaining({ action: 'bury' }));
  });
});
