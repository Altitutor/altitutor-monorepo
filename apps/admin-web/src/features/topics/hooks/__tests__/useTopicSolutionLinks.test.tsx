import { act, renderHook } from '@testing-library/react';
import type { Tables, TablesUpdate } from '@altitutor/shared';
import { useTopicUpdate, type TopicUpdateParams } from '../useTopicUpdate';

const mockWrites: Array<{ id: string; data: TablesUpdate<'topics_files'> }> = [];
const mockToast = jest.fn();
const mockMutate = jest.fn((variables, options) => {
  mockWrites.push(variables);
  options.onSuccess(variables);
});
jest.mock('@altitutor/ui', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('../useTopicsQuery', () => ({
  useUpdateTopic: () => ({ mutate: mockMutate, isPending: false }),
  useUpdateTopicIndices: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock('../useTopicsFilesQuery', () => ({
  useUpdateTopicFile: () => ({ mutate: mockMutate, isPending: false }),
  useUpdateTopicFileIndices: () => ({ mutate: mockMutate, isPending: false }),
  topicsFilesKeys: { byTopic: (id: string) => ['topics-files', id] },
}));
jest.mock('../../api/topics-files', () => ({ topicsFilesApi: {} }));

function params(): TopicUpdateParams {
  const currentTopic = { id: 'topic', name: 'Topic', subject_id: 'subject', parent_id: null } as Tables<'topics'>;
  return {
    topicId: 'topic', currentTopic,
    formData: { name: 'Topic', subject_id: 'subject', parent_id: null },
    reorderedChildren: [], reorderedFiles: [], solutionLinks: [], solutionUnlinks: [],
    currentTopicFiles: [],
  };
}

beforeEach(() => {
  mockWrites.length = 0;
  jest.clearAllMocks();
});

it('saves a converted file as solutions and keeps displaced pending solutions unlinked', async () => {
  const { result } = renderHook(() => useTopicUpdate());
  const input = params();
  input.solutionLinks = [
    { solutionFileId: 'displaced', targetFileId: null },
    { solutionFileId: 'answers', targetFileId: 'questions' },
  ];
  input.currentTopicFiles = [{ id: 'questions', type: 'TEST', is_solutions_of_id: null }] as unknown as TopicUpdateParams['currentTopicFiles'];
  await act(async () => {
    expect((await result.current.updateTopic(input)).success).toBe(true);
  });
  expect(mockWrites).toEqual([
    { id: 'displaced', data: { is_solutions: true, is_solutions_of_id: null, type: undefined } },
    { id: 'answers', data: { is_solutions: true, is_solutions_of_id: 'questions', type: 'TEST' } },
  ]);
});

it('clears old slots before saving swapped solutions so both final links survive', async () => {
  const { result } = renderHook(() => useTopicUpdate());
  const input = params();
  input.solutionLinks = [
    { solutionFileId: 'answer-a', targetFileId: 'question-b' },
    { solutionFileId: 'answer-b', targetFileId: 'question-a' },
  ];
  input.currentTopicFiles = [
    { id: 'question-a', type: 'NOTES', is_solutions_of_id: null },
    { id: 'question-b', type: 'TEST', is_solutions_of_id: null },
    { id: 'answer-a', is_solutions: true, is_solutions_of_id: 'question-a' },
    { id: 'answer-b', is_solutions: true, is_solutions_of_id: 'question-b' },
  ] as unknown as TopicUpdateParams['currentTopicFiles'];
  await act(async () => {
    expect((await result.current.updateTopic(input)).success).toBe(true);
  });
  const finalLinks = new Map<string, string | null>();
  mockWrites.forEach(write => finalLinks.set(write.id, write.data.is_solutions_of_id ?? null));
  expect(finalLinks.get('answer-a')).toBe('question-b');
  expect(finalLinks.get('answer-b')).toBe('question-a');
});
