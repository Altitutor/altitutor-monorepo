import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddStaffToSessionModal } from '../AddStaffToSessionModal';
import { renderWithProviders } from '@/shared/test-utils';

beforeAll(() => {
  (global as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

jest.mock('@/features/staff/api/staff', () => ({
  staffApi: {
    listMinimal: jest.fn(),
  },
}));

import { staffApi } from '@/features/staff/api/staff';

const mockListMinimal = staffApi.listMinimal as jest.MockedFunction<typeof staffApi.listMinimal>;

describe('AddStaffToSessionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListMinimal.mockResolvedValue({
      staff: [
        {
          id: 'staff-1',
          first_name: 'Jane',
          last_name: 'Tutor',
          status: 'ACTIVE',
          role: 'TUTOR',
        } as any,
      ],
      total: 1,
    });
  });

  it('supports two-step flow and confirms selected staff', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <AddStaffToSessionModal
        isOpen={true}
        onClose={jest.fn()}
        sessionTitle="Math Session"
        sessionTime="9:30 AM - 12:30 PM"
        sessionDay="Monday"
        existingStaffIds={[]}
        onConfirm={onConfirm}
      />
    );

    await user.click(await screen.findByRole('button', { name: /jane tutor/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(
      await screen.findByText('Jane Tutor will only be added to a single session on 9:30 AM - 12:30 PM Monday, they will not be assigned to the class')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm add staff/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: 'staff-1' }));
  });
});
