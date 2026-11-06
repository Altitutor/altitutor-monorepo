import { render, screen } from '@testing-library/react';
import ResourceTopicDetailPage from '@/app/(student)/resources/[subjectShortName]/[topicCode]/page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ subjectShortName: 'math', topicCode: 'algebra' }),
}));

jest.mock('@/features/flashcards', () => ({
  useFlashcardTopic: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/features/resources', () => ({
  ResourceAccessDenied: jest.requireActual('../resource-access-denied').ResourceAccessDenied,
  useResourceSubject: () => ({ isPending: true, isLoading: true }),
  useResourceTopic: () => ({ isPending: true, isLoading: false }),
  useResourceAccessBySubject: () => ({ isPending: true, isLoading: true }),
  useResourceTopicFiles: () => ({ isLoading: false }),
  useResourceTopics: () => ({}),
  useResourceFileCountsBySubject: () => ({}),
}));

it('keeps a deep link pending while the topic lookup waits for its subject', () => {
  render(<ResourceTopicDetailPage />);

  expect(screen.getByRole('status')).toHaveTextContent('Checking resource access');
  expect(screen.queryByRole('heading', { name: 'Access Required' })).not.toBeInTheDocument();
});
