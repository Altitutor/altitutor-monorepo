import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminTrialContactForm } from '../AdminTrialContactForm';
import { renderWithProviders } from '@/shared/test-utils';

jest.mock('@/features/subjects/hooks/useSubjectsQuery', () => ({
  useSubjectsList: () => ({ data: { subjects: [] }, isLoading: false }),
}));

jest.mock('@/features/students/components/StudentParentsEditor', () => ({
  StudentParentsEditor: () => <div data-testid="student-parents-editor" />,
}));

describe('AdminTrialContactForm', () => {
  it('marks first name as the only required student field', async () => {
    const user = userEvent.setup();
    const onValidityChange = jest.fn();

    renderWithProviders(
      <AdminTrialContactForm
        onSubmit={jest.fn()}
        onValidityChange={onValidityChange}
      />
    );

    expect(screen.getByText('First Name *')).toBeInTheDocument();
    expect(screen.queryByText('Last Name *')).not.toBeInTheDocument();
    expect(screen.getByText('Last Name')).toBeInTheDocument();
    expect(screen.queryByText('Phone *')).not.toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/first name/i), 'Ada');

    await waitFor(() => {
      expect(onValidityChange).toHaveBeenCalledWith(true);
    });
  });
});
