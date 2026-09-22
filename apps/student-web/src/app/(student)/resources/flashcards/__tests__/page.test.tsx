import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DueFlashcardsPage from '../page';

(global as typeof globalThis & { React: typeof React }).React = React;

type MockButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: string;
};

const mockRefetch = jest.fn();
let mockSessionProps: {
  queueRevision?: number;
  onAnswerPendingChange?: (pending: boolean) => void;
  onAnswerCommitted?: (answerLogId: string) => void;
} = {};

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@altitutor/ui', () => ({
  Alert: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  Button: ({ children, asChild, variant: _variant, ...props }: MockButtonProps) =>
    asChild ? <>{children}</> : <button {...props}>{children}</button>,
}));

jest.mock('@/shared/lib/student-visual', () => ({
  studentCardCn: (className?: string) => className ?? '',
}));

jest.mock('@/features/resources', () => ({
  ResourcesBreadcrumb: () => null,
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
    data: {
      cards: [],
      counts: { total: 0, new: 0, learning: 0, relearning: 0, review: 0 },
      held: { newLimit: 0, reviewLimit: 0, newBlockedByReviews: 0, futureLearning: 0 },
      nextDueAt: null,
      timezoneConfirmationRequired: false,
    },
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
    mockRefetch.mockReset().mockResolvedValue({ error: null });
    mockSessionProps = {};
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it('refreshes and resets the local queue after a successful undo', async () => {
    render(<DueFlashcardsPage />);
    act(() => mockSessionProps.onAnswerCommitted?.('fa100000-0000-4000-8000-000000000001'));

    fireEvent.click(screen.getByRole('button', { name: 'Undo last answer' }));

    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockSessionProps.queueRevision).toBe(1));
    expect(screen.getByRole('status')).toHaveTextContent('Your last answer was undone.');
  });

  it('prevents undo while an answer is being saved', () => {
    render(<DueFlashcardsPage />);

    act(() => mockSessionProps.onAnswerCommitted?.('fa100000-0000-4000-8000-000000000001'));
    act(() => mockSessionProps.onAnswerPendingChange?.(true));

    expect(screen.getByRole('button', { name: 'Undo last answer' })).toBeDisabled();
  });

  it('allows only one undo until another answer is saved', async () => {
    render(<DueFlashcardsPage />);
    act(() => mockSessionProps.onAnswerCommitted?.('fa100000-0000-4000-8000-000000000001'));

    fireEvent.click(screen.getByRole('button', { name: 'Undo last answer' }));
    await screen.findByText('Your last answer was undone.');
    const undoButton = screen.getByRole('button', { name: 'Undo last answer' });
    expect(undoButton).toBeDisabled();
    fireEvent.click(undoButton);
    fireEvent.click(undoButton);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid undo clicks into one database command', () => {
    global.fetch = jest.fn(() => new Promise(() => undefined));
    render(<DueFlashcardsPage />);
    act(() => mockSessionProps.onAnswerCommitted?.('fa100000-0000-4000-8000-000000000001'));

    const undoButton = screen.getByRole('button', { name: 'Undo last answer' });
    fireEvent.click(undoButton);
    fireEvent.click(undoButton);
    fireEvent.click(undoButton);

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

    fireEvent.click(screen.getByRole('button', { name: 'Undo last answer' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Undo last answer' }));

    await screen.findByText('That answer can no longer be undone because the card has changed.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Undo last answer' })).toBeDisabled();
  });
});
