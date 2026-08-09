import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FlashcardReviewCard, ImageOcclusionData } from '@altitutor/shared';
import { FlashcardReviewSession } from '../flashcard-review-session';

jest.mock('@altitutor/ui', () => ({
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

jest.mock('../../hooks/useFlashcards', () => ({
  useRateFlashcardReviewCard: () => ({ mutateAsync: jest.fn() }),
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
  };
}

describe('FlashcardReviewSession image transitions', () => {
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
});
