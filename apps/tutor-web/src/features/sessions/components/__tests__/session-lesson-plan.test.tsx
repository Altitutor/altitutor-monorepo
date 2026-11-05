import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionLessonPlanEditor } from '../SessionLessonPlanEditor';
import { resourcesApi } from '@/features/resources/api/resources';

jest.mock('@/features/resources/api/resources', () => ({
  resourcesApi: {
    getMySubjectNavItems: jest.fn(),
    getTopicsBySubject: jest.fn(),
    getTopicFiles: jest.fn(),
  },
}));
const sessionID = '50000000-0000-0000-0000-000000000005';
it('saves topic intent and reloads it when the rendered preparation panel reopens', async () => {
  let saved = {
    sessionID,
    revision: 0,
    updatedAt: null,
    topics: [] as { id: string; name: string; code: null }[],
    resources: [],
  };
  jest
    .mocked(resourcesApi.getMySubjectNavItems)
    .mockResolvedValue([{ id: 'subject', name: 'Maths' }] as never);
  jest
    .mocked(resourcesApi.getTopicsBySubject)
    .mockResolvedValue([{ id: 'topic', name: 'Functions' }] as never);
  jest.mocked(resourcesApi.getTopicFiles).mockResolvedValue([]);
  global.fetch = jest.fn(async (_url, init) => {
    if (init?.method === 'PUT') {
      expect(JSON.parse(init.body as string)).toEqual({
        expectedRevision: 0,
        topicIds: ['topic'],
        fileIds: [],
      });
      saved = {
        ...saved,
        revision: 1,
        topics: [{ id: 'topic', name: 'Functions', code: null }],
      };
    }
    return { ok: true, json: async () => saved } as Response;
  });
  const first = render(
    <SessionLessonPlanEditor
      sessionID={sessionID}
      subjectID="subject"
      editable
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Add topics and files' }),
  );
  fireEvent.click(
    await screen.findByRole('checkbox', { name: 'Plan Functions' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Plan saved'),
  );
  first.unmount();
  render(
    <SessionLessonPlanEditor
      sessionID={sessionID}
      subjectID="subject"
      editable
    />,
  );
  expect(await screen.findByText('Functions')).toBeInTheDocument();
  expect(screen.getByText(/Confirm what you taught/)).toBeInTheDocument();
});
