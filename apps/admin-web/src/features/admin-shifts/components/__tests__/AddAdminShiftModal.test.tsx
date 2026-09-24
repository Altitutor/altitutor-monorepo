import { render, screen } from '@testing-library/react';
import { AddAdminShiftModal } from '../AddAdminShiftModal';

jest.mock('../../hooks/useAdminShiftsQuery', () => ({
  useCreateAdminShift: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/shared/hooks', () => ({
  useCurrentStaff: () => ({ data: { id: "staff-1" } }),
}));

describe('AddAdminShiftModal', () => {
  it('associates each submit button with the form in its own dialog', () => {
    render(
      <>
        <AddAdminShiftModal
          isOpen
          onClose={jest.fn()}
          onAdminShiftAdded={jest.fn()}
        />
        <AddAdminShiftModal
          isOpen
          onClose={jest.fn()}
          onAdminShiftAdded={jest.fn()}
        />
      </>,
    );

    const forms = Array.from(document.querySelectorAll('form'));
    const submitButtons = screen.getAllByRole('button', {
      name: 'Create Admin Shift',
      hidden: true,
    }) as HTMLButtonElement[];

    expect(forms).toHaveLength(2);
    expect(submitButtons).toHaveLength(2);
    expect(submitButtons[0].form).toBe(forms[0]);
    expect(submitButtons[1].form).toBe(forms[1]);
  });
});
