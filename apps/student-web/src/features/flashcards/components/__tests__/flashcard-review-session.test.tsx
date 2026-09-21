import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FlashcardReviewCard, ImageOcclusionData } from '@altitutor/shared';
import { FlashcardReviewSession } from '../flashcard-review-session';

jest.mock('@altitutor/ui', () => ({
  createStoredImageHtmlRenderer: () => ({
    refresh: async (html: string | null | undefined) => html ?? '',
    preload: async () => undefined,
    clearCache: () => undefined,
  }),
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
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

describe('FlashcardReviewSession image transitions', () => {
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
});
