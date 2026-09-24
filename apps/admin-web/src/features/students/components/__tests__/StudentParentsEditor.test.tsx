import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentParentsEditor } from '../StudentParentsEditor';
import { parentsApi } from '@/features/parents/api/parents';
import { renderWithProviders } from '@/shared/test-utils';
import {
  emptyStudentParentDraft,
  studentParentDraftFromExisting,
  type StudentParentDraft,
} from '../../utils/studentParentDrafts';
import { useState } from 'react';

jest.mock('@/features/parents/api/parents', () => ({
  parentsApi: {
    list: jest.fn(),
  },
}));

const mockedParentsApi = jest.mocked(parentsApi);

const existingParent = {
  id: 'parent-existing',
  first_name: 'Sam',
  last_name: 'Cole',
  email: 'sam.cole@parent.test',
  phone: '+61420000001',
  user_id: null,
  invite_token: null,
  created_by: null,
  created_at: null,
  updated_at: null,
};

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function EditorHarness({
  initialValue = [],
  showSkip = false,
}: {
  initialValue?: StudentParentDraft[];
  showSkip?: boolean;
}) {
  const [value, setValue] = useState<StudentParentDraft[]>(initialValue);
  const [skipped, setSkipped] = useState(false);

  return (
    <StudentParentsEditor
      value={value}
      onChange={setValue}
      showSkip={showSkip}
      skipped={skipped}
      onSkippedChange={setSkipped}
    />
  );
}

describe('StudentParentsEditor', () => {
  beforeAll(() => {
    global.ResizeObserver = ResizeObserverStub;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedParentsApi.list.mockResolvedValue({
      parents: [existingParent],
      total: 1,
    });
  });

  it('lets staff add a new parent form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EditorHarness />);

    await user.click(screen.getByRole('button', { name: /add new/i }));

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByText('New parent 1')).toBeInTheDocument();
  });

  it('lets staff link an existing parent without showing editable fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EditorHarness />);

    await user.click(screen.getByRole('button', { name: /link existing/i }));
    await user.click(await screen.findByText('Sam Cole'));

    expect(screen.getByText('Sam Cole')).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.getByText('sam.cole@parent.test')).toBeInTheDocument();
    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
  });

  it('can skip parent details', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EditorHarness
        showSkip
        initialValue={[emptyStudentParentDraft()]}
      />
    );

    await user.click(screen.getByLabelText('Skip parent details'));

    await waitFor(() => {
      expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /link existing/i })).not.toBeInTheDocument();
  });

  it('shows a linked existing parent from the current value', () => {
    renderWithProviders(
      <EditorHarness
        initialValue={[
          studentParentDraftFromExisting({
            id: 'parent-existing',
            first_name: 'Sam',
            last_name: 'Cole',
            email: 'sam.cole@parent.test',
            phone: '+61420000001',
          }),
        ]}
      />
    );

    expect(screen.getByText('Sam Cole')).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
  });
});
