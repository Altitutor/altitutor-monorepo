import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FlashcardReviewCard, FlashcardStudySnapshot, RateFlashcardCommand } from '@altitutor/shared';
import { queryClient as applicationQueryClient } from '@/shared/lib/react-query/client';
import DueFlashcardsPage from '../page';

(global as typeof globalThis & { React: typeof React }).React = React;
let mockSearchParams = 'study=all';
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mockSearchParams) }));
jest.mock('@/features/flashcards', () => ({
  ...jest.requireActual('@/features/flashcards/hooks/useFlashcards'),
  ...jest.requireActual('@/features/flashcards/components/flashcard-review-session'),
}));
jest.mock('@/features/resources', () => ({ ResourcesBreadcrumb: () => null, useResourceSubjects: () => ({ data: [] }) }));
jest.mock('@/shared/components/layouts', () => ({ StudentPageContainer: ({ children }: React.PropsWithChildren) => <main>{children}</main> }));
jest.mock('@/shared/lib/student-visual', () => ({ studentCardCn: (value?: string) => value ?? '' }));
jest.mock('@/features/flashcards/components/manage-flashcards-dialog', () => ({ ManageFlashcardsDialog: () => null }));

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; variant?: string; size?: string };
jest.mock('@altitutor/ui', () => ({
  createStoredImageHtmlRenderer: () => ({ refresh: async (html: string | null) => html ?? '', preload: async () => undefined, clearCache: () => undefined }),
  Button: ({ children, asChild, variant: _variant, size: _size, ...props }: ButtonProps) => asChild ? <>{children}</> : <button {...props}>{children}</button>,
  Alert: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ClickableCardRevealChevron: () => null,
  Skeleton: () => null,
  clickableCardHoverCn: '',
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

function reviewCard(id: string, label: string): FlashcardReviewCard {
  return {
    id, flashcard_id: `flashcard-${id}`, cloze_index: 1, topic_id: 'topic-1',
    card_type: 'text_cloze', cloze_text: `${label}: {{c1::answer}}`, extra: null,
    image_file_id: null, image_alt_text: null, image_storage_path: null, image_mimetype: null,
    occlusion_data: null, flashcard_index: 1, due_at: '2000-01-01T00:00:00Z',
    stability: null, difficulty: null, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0,
    state: 'New', last_reviewed_at: null, last_rating: null, revision: 0,
    buried_until: null, buried_reason: null, suspended_at: null, leech_at: null,
  };
}

function snapshot(cards: FlashcardReviewCard[]): FlashcardStudySnapshot {
  return {
    cards, counts: { total: cards.length, new: cards.length, learning: 0, relearning: 0, review: 0 },
    held: { buried: 0, suspended: 0, newLimit: 0, reviewLimit: 0, newBlockedByReviews: 0, futureLearning: 0 },
    nextDueAt: null, timezone: 'Australia/Adelaide', timezoneConfirmationRequired: false,
    catalogTotal: 2, subjects: [{ id: 'subject-1', name: 'Mathematics', shortName: 'Maths', topicIds: ['topic-1'], total: 2, new: cards.length, learning: 0, review: 0 }],
  };
}

function response(data: unknown, status = 200): Response {
  return { ok: status === 200, status, json: async () => status === 200 ? { data } : data } as Response;
}

it.each([
  { study: 'study=all', entry: 'menu' },
  { study: 'subject=subject-1', entry: 'menu' },
  { study: 'study=all', entry: 'remount' },
  { study: 'subject=subject-1', entry: 'remount' },
])('waits for current cards when re-entering $study through $entry after an answer', async ({ study, entry }) => {
  let requestNumber = 0;
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => `00000000-0000-4000-8000-${String(++requestNumber).padStart(12, '0')}` });
  const first = reviewCard('first', 'First prompt');
  const second = reviewCard('second', 'Second prompt');
  let serverCards = [first, second];
  let answerSaved = false;
  let releaseSnapshot: (() => void) | undefined;
  const commands: RateFlashcardCommand[] = [];
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const command = JSON.parse(String(init.body)) as RateFlashcardCommand;
      commands.push(command);
      const card = serverCards.find(card => card.id === command.reviewCardId);
      if (!card || command.expectedRevision !== card.revision) return response({ error: 'flashcard_stale_revision' }, 409);
      answerSaved = true;
      serverCards = serverCards.filter(card => card.id !== command.reviewCardId);
      return response({ ...card, revision: 1, state: 'Review', due_at: '2100-01-01T00:00:00Z', answer_log_id: `answer-${commands.length}` });
    }
    if (answerSaved) return new Promise<Response>((resolve) => { releaseSnapshot = () => resolve(response(snapshot(serverCards))); });
    return response(snapshot(serverCards));
  });
  const defaults = applicationQueryClient.getDefaultOptions();
  const client = new QueryClient({ defaultOptions: { queries: { ...defaults.queries, retry: false }, mutations: { ...defaults.mutations, retry: false } } });
  const page = <QueryClientProvider client={client}><DueFlashcardsPage /></QueryClientProvider>;
  mockSearchParams = study;
  let view = render(page);
  try {
    await screen.findByText(/First prompt/);
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }));
    fireEvent.click(screen.getByRole('button', { name: /Good/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Undo/ })).toBeEnabled());
    if (entry === 'menu') {
      mockSearchParams = '';
      view.rerender(<QueryClientProvider client={client}><DueFlashcardsPage /></QueryClientProvider>);
      await waitFor(() => expect(releaseSnapshot).toBeDefined());
      mockSearchParams = study;
      view.rerender(<QueryClientProvider client={client}><DueFlashcardsPage /></QueryClientProvider>);
    } else {
      view.unmount();
      view = render(page);
    }
    await waitFor(() => expect(releaseSnapshot).toBeDefined());
    expect(screen.queryByText(/First prompt/)).not.toBeInTheDocument();
    await act(async () => releaseSnapshot?.());
    await screen.findByText(/Second prompt/);
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }));
    fireEvent.click(screen.getByRole('button', { name: /Good/ }));
    await waitFor(() => expect(commands.map(command => command.reviewCardId)).toEqual(['first', 'second']));
    expect(screen.queryByText(/Your answer was not saved/)).not.toBeInTheDocument();
  } finally {
    view.unmount();
    client.clear();
    global.fetch = originalFetch;
  }
});
