import { fireEvent, render, screen } from '@testing-library/react';
import { AbsenceTreatmentCell } from '../AbsenceTreatmentCell';

describe('AbsenceTreatmentCell', () => {
  it('describes credit as a selection rather than a completed financial outcome', () => {
    render(
      <AbsenceTreatmentCell treatment="credit" recordedDate="02/01/2026" />,
    );
    expect(screen.getByText('Credit')).toHaveAttribute(
      'title',
      expect.stringContaining('See Invoice for the financial outcome'),
    );
    expect(screen.getByText('Credit')).toHaveAttribute(
      'title',
      expect.stringContaining('Selected 02/01/2026'),
    );
  });

  it('opens a replacement without requiring its date label and stops row navigation', () => {
    const onOpenSession = jest.fn();
    const onRowClick = jest.fn();
    render(
      <div onClick={onRowClick}>
        <AbsenceTreatmentCell
          treatment="replacement"
          replacementSessionId="target-session"
          onOpenSession={onOpenSession}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Replacement' }));
    expect(onOpenSession).toHaveBeenCalledWith('target-session');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('still shows replacement when the linked session is unavailable', () => {
    render(<AbsenceTreatmentCell treatment="replacement" />);
    expect(screen.getByText('Replacement')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows no treatment for a student without a planned absence', () => {
    render(<AbsenceTreatmentCell treatment={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
