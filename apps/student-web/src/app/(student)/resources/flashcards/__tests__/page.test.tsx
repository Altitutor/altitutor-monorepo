import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import DueFlashcardsPage from '../page';

(global as typeof globalThis & { React: typeof React }).React = React;

type MockButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: string;
};

const mockRefetch = jest.fn();
let mockSearchParams = 'study=all';
let mockDueSnapshot: {
  cards: never[];
  counts: { total: number; new: number; learning: number; relearning: number; review: number };
  held: { newLimit: number; reviewLimit: number; newBlockedByReviews: number; futureLearning: number };
  nextDueAt: null;
  timezoneConfirmationRequired: boolean;
  catalogTotal: number;
  subjects: Array<{
    id: string;
    name: string;
    shortName: string | null;
    topicIds: string[];
    total: number;
    new: number;
    learning: number;
    review: number;
  }>;
} = {
  cards: [],
  counts: { total: 0, new: 0, learning: 0, relearning: 0, review: 0 },
  held: { newLimit: 0, reviewLimit: 0, newBlockedByReviews: 0, futureLearning: 0 },
  nextDueAt: null,
  timezoneConfirmationRequired: false,
  catalogTotal: 0,
  subjects: [],
};
let mockSessionProps: {
  queueRevision?: number;
  pinnedLayout?: boolean;
  undoDisabled?: boolean;
  queueHold?: {
    newLimit: number;
    reviewLimit: number;
    newBlockedByReviews: number;
    futureLearning: number;
    nextDueAt: string | null;
  };
  onAnswerPendingChange?: (pending: boolean) => void;
  onAnswerCommitted?: (answerLogId: string) => void;
  onUndo?: () => void | Promise<void>;
} = {};

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

jest.mock('@altitutor/ui', () => ({
  Alert: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  Button: ({ children, asChild, variant: _variant, ...props }: MockButtonProps) =>
    asChild ? <>{children}</> : <button {...props}>{children}</button>,
  Card: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
  ClickableCardRevealChevron: () => null,
  Skeleton: () => null,
  clickableCardHoverCn: '',
}));

jest.mock('@/shared/lib/student-visual', () => ({
  studentCardCn: (className?: string) => className ?? '',
}));

jest.mock('@/features/resources', () => ({
  ResourcesBreadcrumb: () => null,
  useResourceSubjects: () => ({ data: [] }),
}));

jest.mock('@/shared/components/layouts', () => ({
  StudentPageContainer: ({ children }: React.PropsWithChildren) => <main>{children}</main>,
}));

jest.mock('@/features/flashcards/components/manage-flashcards-dialog', () => ({
  ManageFlashcardsDialog: () => null,
}));

jest.mock('@/features/flashcards', () => ({
  FlashcardReviewSession: (props: typeof mockSessionProps) => {
    mockSessionProps = props;
    return <div data-testid="review-session" />;
  },
  useDueFlashcardReviewCards: () => ({
    data: mockDueSnapshot,
    error: null,
    isLoading: false,
    refetch: mockRefetch,
  }),
}));

describe('DueFlashcardsPage undo flow', () => {
  beforeAll(() => {
    Object.defineProperty(global.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => '00000000-0000-4000-8000-000000000001'),
    });
  });

  beforeEach(() => {
    mockSearchParams = 'study=all';
    mockDueSnapshot = {
      cards: [],
      counts: { total: 0, new: 0, learning: 0, relearning: 0, review: 0 },
      held: { newLimit: 0, reviewLimit: 0, newBlockedByReviews: 0, futureLearning: 0 },
      nextDueAt: null,
      timezoneConfirmationRequired: false,
      catalogTotal: 0,
      subjects: [],
    };
    mockRefetch.mockReset().mockResolvedValue({ error: null });
    mockSessionProps = {};
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it('refreshes and resets the local queue after a successful undo', async () => {
    render(<DueFlashcardsPage />);
    act(() => mockSessionProps.onAnswerCommitted?.('fa100000-0000-4000-8000-000000000001'));

    await act(async () => {
      await mockSessionProps.onUndo?.();
    });

    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockSessionProps.queueRevision).toBe(1));
    expect(screen.getByRole('status')).toHaveTextContent('Your last answer was undone.');
  });

  it('prevents undo while an answer is being saved', async () => {
    render(<DueFlashcardsPage />);

    act(() => mockSessionProps.onAnswerCommitted?.('fa100000-0000-4000-8000-000000000001'));
    act(() => mockSessionProps.onAnswerPendingChange?.(true));

    expect(mockSessionProps.undoDisabled).toBe(true);
    await act(async () => {
      await mockSessionProps.onUndo?.();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows only one undo until another answer is saved', async () => {
    render(<DueFlashcardsPage />);
    act(() => mockSessionProps.onAnswerCommitted?.('fa100000-0000-4000-8000-000000000001'));

    await act(async () => {
      await mockSessionProps.onUndo?.();
    });
    await screen.findByText('Your last answer was undone.');
    expect(mockSessionProps.undoDisabled).toBe(true);
    await act(async () => {
      await mockSessionProps.onUndo?.();
      await mockSessionProps.onUndo?.();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid undo clicks into one database command', () => {
    global.fetch = jest.fn(() => new Promise(() => undefined));
    render(<DueFlashcardsPage />);
    act(() => mockSessionProps.onAnswerCommitted?.('fa100000-0000-4000-8000-000000000001'));

    act(() => {
      void mockSessionProps.onUndo?.();
      void mockSessionProps.onUndo?.();
      void mockSessionProps.onUndo?.();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries one transient command conflict without showing an undo failure', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'flashcard_command_in_progress',
          code: 'flashcard_command_in_progress',
        }),
      })
      .mockResolvedValueOnce({ ok: true });
    render(<DueFlashcardsPage />);
    act(() => mockSessionProps.onAnswerCommitted?.('fa100000-0000-4000-8000-000000000001'));

    await act(async () => {
      await mockSessionProps.onUndo?.();
    });

    await screen.findByText('Your last answer was undone.');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Your last answer could not be undone. Please try again.')).not.toBeInTheDocument();
  });

  it('does not retry a true undo revision conflict', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'flashcard_undo_conflict',
        code: 'flashcard_undo_conflict',
      }),
    });
    render(<DueFlashcardsPage />);
    act(() => mockSessionProps.onAnswerCommitted?.('fa100000-0000-4000-8000-000000000001'));

    await act(async () => {
      await mockSessionProps.onUndo?.();
    });

    await screen.findByText('That answer can no longer be undone because the card has changed.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockSessionProps.undoDisabled).toBe(true);
  });

  it('keeps manage and settings in the header and passes held cards into the session', () => {
    render(<DueFlashcardsPage />);

    expect(screen.getByRole('button', { name: 'Manage' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeVisible();
    expect(mockSessionProps.pinnedLayout).toBe(true);
    expect(mockSessionProps.undoDisabled).toBe(true);
    expect(mockSessionProps.queueHold).toEqual({
      newLimit: 0,
      reviewLimit: 0,
      newBlockedByReviews: 0,
      futureLearning: 0,
      nextDueAt: null,
    });
  });

  it('lists study all and subjects with cards, and does not open a study session', () => {
    mockSearchParams = '';
    mockDueSnapshot = {
      ...mockDueSnapshot,
      catalogTotal: 5,
      counts: { total: 4, new: 2, learning: 1, relearning: 1, review: 1 },
      subjects: [
        { id: 'bio', name: 'Biology', shortName: 'bio', topicIds: ['topic-bio'], total: 3, new: 1, learning: 1, review: 1 },
        { id: 'empty', name: 'Physics', shortName: 'phys', topicIds: [], total: 0, new: 0, learning: 0, review: 0 },
      ],
    };

    render(<DueFlashcardsPage />);

    expect(screen.queryByTestId('review-session')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Study all/ })).toHaveAttribute('href', '/resources/flashcards?study=all');
    expect(screen.getByRole('link', { name: /Study all/ })).toHaveTextContent('5 cards');
    expect(screen.getByRole('link', { name: /Study all/ })).toHaveTextContent('2 new + 2 learning + 1 review');
    expect(screen.getByRole('link', { name: /Biology/ })).toHaveAttribute('href', '/resources/flashcards?subject=bio');
    expect(screen.getByRole('link', { name: /Biology/ })).toHaveTextContent('3 cards');
    expect(screen.getByRole('link', { name: /Biology/ })).toHaveTextContent('1 new + 1 learning + 1 review');
    expect(screen.queryByRole('link', { name: /Physics/ })).not.toBeInTheDocument();
  });
});
