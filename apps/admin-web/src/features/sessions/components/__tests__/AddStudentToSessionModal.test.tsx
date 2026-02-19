import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddStudentToSessionModal } from '../AddStudentToSessionModal';
import { renderWithProviders } from '@/shared/test-utils';

beforeAll(() => {
  (global as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

jest.mock('@/features/students/api/students', () => ({
  studentsApi: {
    listMinimal: jest.fn(),
  },
}));

import { studentsApi } from '@/features/students/api/students';

const mockListMinimal = studentsApi.listMinimal as jest.MockedFunction<typeof studentsApi.listMinimal>;

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
        } as any,
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

    await user.click(await screen.findByRole('button', { name: /john doe/i }));
    expect(nextButton).toBeEnabled();

    await user.click(nextButton);

    expect(
      await screen.findByText('John Doe will only be added to a single session on 9:30 AM - 12:30 PM Monday, they will not be enrolled in the class')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm add student/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: 'student-1' }));
  });

  it('excludes students already in session from step 1 list', async () => {
    renderWithProviders(
      <AddStudentToSessionModal
        isOpen={true}
        onClose={jest.fn()}
        sessionTitle="Math Session"
        sessionTime="9:30 AM - 12:30 PM"
        sessionDay="Monday"
        existingStudentIds={['student-1']}
        onConfirm={jest.fn().mockResolvedValue(undefined)}
      />
    );

    expect(await screen.findByText(/no students available to add/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /john doe/i })).not.toBeInTheDocument();
  });
});
