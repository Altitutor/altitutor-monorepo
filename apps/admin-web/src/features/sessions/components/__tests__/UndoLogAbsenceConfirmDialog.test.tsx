import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/shared/test-utils';
import { UndoLogAbsenceConfirmDialog } from '../UndoLogAbsenceConfirmDialog';

describe('UndoLogAbsenceConfirmDialog', () => {
  it('renders primary and secondary preview text', () => {
    renderWithProviders(
      <UndoLogAbsenceConfirmDialog
        isOpen={true}
        title="Undo logged absence?"
        description="Mark Jane Doe as attending Session A?"
        secondaryDescription="This will remove them from the rescheduled session Session B."
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    expect(screen.getByText('Undo logged absence?')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Mark Jane Doe as attending Session A?');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('This will remove them from the rescheduled session Session B.');
  });
});
