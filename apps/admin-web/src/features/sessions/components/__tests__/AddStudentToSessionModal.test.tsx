import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddStudentToSessionModal } from '../AddStudentToSessionModal';
import { renderWithProviders } from '@/shared/test-utils';
import type { Tables } from '@altitutor/shared';

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    writable: true,
  });
});

jest.mock('@/features/students/api/students', () => ({
  studentsApi: {
    listMinimal: jest.fn(),
  },
}));

import { studentsApi } from '@/features/students/api/students';

const mockListMinimal = studentsApi.listMinimal as jest.MockedFunction<typeof studentsApi.listMinimal>;
const mockToast = jest.fn();

jest.mock('@altitutor/ui', () => ({
  ...jest.requireActual('@altitutor/ui'),
  useToast: () => ({ toast: mockToast }),
}));

const newStudent = {
  id: 'student-2', first_name: 'Jane', last_name: 'Doe', status: 'ACTIVE', curriculum: 'SACE', year_level: 11,
} as Tables<'students'>;

const defaultProps = {
  isOpen: true, onClose: jest.fn(), sessionTitle: 'Math Session',
  sessionTime: '9:30 AM - 12:30 PM', sessionDay: 'Monday', existingStudentIds: ['student-1'],
  onConfirm: jest.fn().mockResolvedValue(undefined),
};

describe('AddStudentToSessionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListMinimal.mockResolvedValue({
      students: [
        {
          id: 'student-1',
          first_name: 'John',
          last_name: 'Doe',
          status: 'ACTIVE',
          curriculum: 'SACE',
          year_level: 11,
        } as Tables<'students'>,
      ],
      total: 1,
    });
  });

  it('requires step 1 selection and shows warning in step 2', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <AddStudentToSessionModal
        isOpen={true}
        onClose={jest.fn()}
        sessionTitle="Math Session"
        sessionTime="9:30 AM - 12:30 PM"
        sessionDay="Monday"
        existingStudentIds={[]}
        onConfirm={onConfirm}
      />
    );

    const nextButton = await screen.findByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();

    await user.click(await screen.findByText('John Doe'));
    expect(nextButton).toBeEnabled();

    await user.click(nextButton);

    expect(
      await screen.findByText('John Doe will only be added to a single session on 9:30 AM - 12:30 PM Monday, they will not be enrolled in the class')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm add student/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: 'student-1' }));
  });

  it('shows all-existing matches as unavailable rows instead of an empty result', async () => {
    renderWithProviders(<AddStudentToSessionModal {...defaultProps} />);
    const row = await screen.findByRole('button', { name: /John Doe.*already in this session/i });
    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(row).not.toHaveAttribute('disabled');
    expect(within(row).getByText('Already in this session')).toBeVisible();
    expect(screen.queryByText(/no students available to add/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('keeps existing and new matches visible after searching and preserves selection of a new student', async () => {
    const user = userEvent.setup();
    // Use the same deterministic fixture for each server search response.
    mockListMinimal.mockResolvedValue({ students: [{ id: 'student-1', first_name: 'John', last_name: 'Doe', status: 'ACTIVE' } as Tables<'students'>, newStudent], total: 2 });
    renderWithProviders(<AddStudentToSessionModal {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('Search students...'), 'Doe');
    const existingRow = await screen.findByRole('button', { name: /John Doe.*already in this session/i });
    const newRow = await screen.findByRole('button', { name: /^Jane Doe$/i });
    await user.click(newRow);
    await user.click(existingRow);
    expect(newRow).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    expect(mockListMinimal).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Doe', statuses: ['ACTIVE', 'TRIAL'], limit: 50, offset: 0 }));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Already in this session' }));
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it.each(['click', 'Enter', ' '] as const)('explains an existing participant on %s without selecting or adding them', async (activation) => {
    const user = userEvent.setup();
    renderWithProviders(<AddStudentToSessionModal {...defaultProps} />);
    const row = await screen.findByRole('button', { name: /John Doe.*already in this session/i });
    if (activation === 'click') await user.click(row);
    else {
      row.focus();
      await user.keyboard(activation === 'Enter' ? '{Enter}' : ' ');
    }
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Already in this session', description: 'John Doe is already in this session and cannot be added again.',
    }));
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('does not confirm a student who becomes an existing participant after selection', async () => {
    const user = userEvent.setup();
    const props = { ...defaultProps, existingStudentIds: [] as string[] };
    const { rerender } = renderWithProviders(<AddStudentToSessionModal {...props} />);
    await user.click(await screen.findByText('John Doe'));
    await user.click(screen.getByRole('button', { name: /next/i }));
    rerender(<AddStudentToSessionModal {...props} existingStudentIds={['student-1']} />);
    const confirm = screen.getByRole('button', { name: /confirm add student/i });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('starts only one confirmation while the previous callback is still pending', async () => {
    const user = userEvent.setup();
    let resolveConfirmation!: () => void;
    const pending = new Promise<void>((resolve) => { resolveConfirmation = resolve; });
    const onConfirm = jest.fn(() => pending);
    renderWithProviders(<AddStudentToSessionModal {...defaultProps} existingStudentIds={[]} onConfirm={onConfirm} />);
    await user.click(await screen.findByText('John Doe'));
    await user.click(screen.getByRole('button', { name: /next/i }));
    const confirm = screen.getByRole('button', { name: /confirm add student/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => { resolveConfirmation(); await pending; });
  });

  it('allows a retry after a failed confirmation', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn().mockRejectedValueOnce(new Error('Temporary failure')).mockResolvedValue(undefined);
    renderWithProviders(<AddStudentToSessionModal {...defaultProps} existingStudentIds={[]} onConfirm={onConfirm} />);
    await user.click(await screen.findByText('John Doe'));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /confirm add student/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /confirm add student/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /confirm add student/i }));
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
