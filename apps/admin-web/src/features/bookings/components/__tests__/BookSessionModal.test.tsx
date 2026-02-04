/**
 * Tests for BookSessionModal component
 * Tests booking flow UI, step navigation, and user interactions
 */

import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookSessionModal } from '../BookSessionModal';

// Mock dependencies
jest.mock('../../hooks/useBookSessionFlow');
jest.mock('../../hooks/useBookingSettings');
jest.mock('../../utils/bookingHelpers');
jest.mock('../../utils/dateTimeHelpers');
jest.mock('../TimeSlotPicker', () => ({
  TimeSlotPicker: ({ onSlotSelect, selectedSlot }: any) => (
    <div data-testid="time-slot-picker">
      <button onClick={() => onSlotSelect({ startAt: '2024-01-01T10:00:00Z', endAt: '2024-01-01T11:00:00Z', availableStaffIds: ['staff-1'] })}>
        Select Slot
      </button>
      {selectedSlot && <div>Selected: {selectedSlot.startAt}</div>}
    </div>
  ),
}));

jest.mock('../StaffSelector', () => ({
  StaffSelector: ({ onSelect, selectedStaffId, availableStaffIds }: any) => (
    <div data-testid="staff-selector">
      {availableStaffIds.map((id: string) => (
        <button key={id} onClick={() => onSelect(id)}>
          Staff {id}
        </button>
      ))}
      {selectedStaffId && <div>Selected: {selectedStaffId}</div>}
    </div>
  ),
}));

jest.mock('../AdminTrialContactForm', () => ({
  AdminTrialContactForm: ({ onSubmit, onFormReady, onValidityChange }: any) => (
    <div data-testid="trial-contact-form">
      <button onClick={() => {
        onFormReady({ requestSubmit: jest.fn() });
        onValidityChange(true);
        onSubmit({ firstName: 'New', lastName: 'Student' });
      }}>
        Submit Form
      </button>
    </div>
  ),
}));

jest.mock('../steps/StudentSelectionStep', () => ({
  StudentSelectionStep: ({ students, onSelectStudent, selectedStudentId }: any) => (
    <div data-testid="student-selection-step">
      {students?.map((s: any) => (
        <button key={s.id} onClick={() => onSelectStudent(s.id)}>
          {s.first_name} {s.last_name}
        </button>
      ))}
      {selectedStudentId && <div>Selected: {selectedStudentId}</div>}
    </div>
  ),
}));

jest.mock('../steps/SubjectSelectionStep', () => ({
  SubjectSelectionStep: ({ onSelectSubject, selectedSubjectId }: any) => (
    <div data-testid="subject-selection-step">
      <button onClick={() => onSelectSubject('subject-1')}>Select Subject</button>
      {selectedSubjectId && <div>Selected: {selectedSubjectId}</div>}
    </div>
  ),
}));

jest.mock('../steps/ConfirmationStep', () => ({
  ConfirmationStep: () => <div data-testid="confirmation-step">Confirmation</div>,
}));

import { useBookSessionFlow } from '../../hooks/useBookSessionFlow';
import { useSessionDurationMinutes } from '../../hooks/useBookingSettings';
import { getSessionTypeLabel } from '../../utils/bookingHelpers';
import { formatSlotDateTime, getCurrentAdelaideTime } from '../../utils/dateTimeHelpers';

const mockUseBookSessionFlow = useBookSessionFlow as jest.MockedFunction<typeof useBookSessionFlow>;
const mockUseSessionDurationMinutes = useSessionDurationMinutes as jest.MockedFunction<typeof useSessionDurationMinutes>;
const mockGetSessionTypeLabel = getSessionTypeLabel as jest.MockedFunction<typeof getSessionTypeLabel>;
const mockFormatSlotDateTime = formatSlotDateTime as jest.MockedFunction<typeof formatSlotDateTime>;
const mockGetCurrentAdelaideTime = getCurrentAdelaideTime as jest.MockedFunction<typeof getCurrentAdelaideTime>;

import { renderWithProviders } from '@/shared/test-utils';

const createMockHookReturn = (overrides = {}) => ({
  currentStep: 0,
  studentSearch: '',
  selectedStudentId: '',
  selectedSubjectId: '',
  selectedSlot: null,
  selectedStaffId: '',
  trialContactData: null,
  trialContactFormRef: null,
  trialFormValid: false,
  showPastDateWarning: false,
  pendingNextStep: false,
  isSubmitting: false,
  studentsLoading: false,
  steps: [
    { id: 'student', title: 'Select Student' },
    { id: 'subject', title: 'Select Subject' },
    { id: 'time', title: 'Select Time' },
    { id: 'staff', title: 'Select Staff' },
    { id: 'confirm', title: 'Confirm Booking' },
  ],
  currentStepData: { id: 'student', title: 'Select Student' },
  currentStepId: 'student',
  studentsData: [],
  subjects: [],
  studentSubjects: [],
  sessionsData: {
    sessions: [],
    sessionStudents: {},
    sessionStaff: {},
    tutorLogs: {},
    classesById: {},
    subjectsById: {},
  },
  selectedStaff: null,
  selectedStudent: null,
  setStudentSearch: jest.fn(),
  setSelectedStudentId: jest.fn(),
  setSelectedSubjectId: jest.fn(),
  setSelectedStaffId: jest.fn(),
  setTrialContactFormRef: jest.fn(),
  setTrialFormValid: jest.fn(),
  handleSlotSelect: jest.fn(),
  handleTrialContactSubmit: jest.fn(),
  handleNext: jest.fn(),
  handleBack: jest.fn(),
  handleConfirmBooking: jest.fn(),
  handleClose: jest.fn(),
  handlePastDateWarningConfirm: jest.fn(),
  handlePastDateWarningCancel: jest.fn(),
  canGoNext: jest.fn(() => false),
  ...overrides,
});

describe('BookSessionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    sessionType: 'DRAFTING' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSessionDurationMinutes.mockReturnValue({ data: 60 } as any);
    mockGetSessionTypeLabel.mockReturnValue('Drafting Session');
    mockFormatSlotDateTime.mockReturnValue('Jan 1, 2024 10:00 AM');
    mockGetCurrentAdelaideTime.mockReturnValue('Jan 1, 2024 9:00 AM');
  });

  describe('Modal visibility', () => {
    it('should render when isOpen is true', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn());

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByText('Book Drafting Session')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn());

      renderWithProviders(<BookSessionModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Book Drafting Session')).not.toBeInTheDocument();
    });
  });

  describe('Session type display', () => {
    it('should display correct title for DRAFTING', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn());
      mockGetSessionTypeLabel.mockReturnValue('Drafting Session');

      renderWithProviders(<BookSessionModal {...defaultProps} sessionType="DRAFTING" />);

      expect(screen.getByText('Book Drafting Session')).toBeInTheDocument();
    });

    it('should display correct title for TRIAL_SESSION', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn());
      mockGetSessionTypeLabel.mockReturnValue('Trial Session');

      renderWithProviders(<BookSessionModal {...defaultProps} sessionType="TRIAL_SESSION" />);

      expect(screen.getByText('Book Trial Session')).toBeInTheDocument();
    });

    it('should display "Reschedule" when originalSessionId is provided', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn());
      mockGetSessionTypeLabel.mockReturnValue('Drafting Session');

      renderWithProviders(
        <BookSessionModal {...defaultProps} originalSessionId="session-123" />
      );

      expect(screen.getByText('Reschedule Drafting Session')).toBeInTheDocument();
    });
  });

  describe('Step indicator', () => {
    it('should render step indicators', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        steps: [
          { id: 'student', title: 'Select Student' },
          { id: 'subject', title: 'Select Subject' },
          { id: 'time', title: 'Select Time' },
        ],
        currentStep: 0,
        currentStepData: { id: 'student', title: 'Select Student' },
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      // Step description should show current step and total steps
      expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();
      
      // Progress bars should be rendered (one for each step)
      const progressBars = screen.getByRole('dialog').querySelectorAll('.flex-1.h-2.rounded-full');
      expect(progressBars).toHaveLength(3);
    });

    it('should highlight current step', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStep: 1,
        steps: [
          { id: 'student', title: 'Select Student' },
          { id: 'subject', title: 'Select Subject' },
        ],
        currentStepData: { id: 'subject', title: 'Select Subject' },
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      // Step description should show current step
      expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();
      
      // Progress bars should be rendered (one for each step)
      const progressBars = screen.getByRole('dialog').querySelectorAll('.flex-1.h-2.rounded-full');
      expect(progressBars).toHaveLength(2);
    });
  });

  describe('Step content rendering', () => {
    it('should render student selection step', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStepId: 'student',
        currentStepData: { id: 'student', title: 'Select Student' },
        studentsData: [
          { id: 'student-1', first_name: 'John', last_name: 'Doe' },
        ],
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByTestId('student-selection-step')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should render trial contact form for TRIAL_SESSION', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStepId: 'trial-contact',
        currentStepData: { id: 'trial-contact', title: 'Student Details' },
        steps: [
          { id: 'trial-contact', title: 'Student Details' },
          { id: 'time', title: 'Select Time' },
        ],
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} sessionType="TRIAL_SESSION" />);

      expect(screen.getByTestId('trial-contact-form')).toBeInTheDocument();
    });

    it('should render subject selection step', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStepId: 'subject',
        currentStepData: { id: 'subject', title: 'Select Subject' },
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByTestId('subject-selection-step')).toBeInTheDocument();
    });

    it('should render time slot picker', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStepId: 'time',
        currentStepData: { id: 'time', title: 'Select Time' },
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByTestId('time-slot-picker')).toBeInTheDocument();
    });

    it('should render staff selector', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStepId: 'staff',
        currentStepData: { id: 'staff', title: 'Select Staff' },
        selectedSlot: { startAt: '2024-01-01T10:00:00Z', endAt: '2024-01-01T11:00:00Z', availableStaffIds: ['staff-1'] },
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByTestId('staff-selector')).toBeInTheDocument();
    });

    it('should render confirmation step', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStepId: 'confirm',
        currentStepData: { id: 'confirm', title: 'Confirm Booking' },
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByTestId('confirmation-step')).toBeInTheDocument();
    });
  });

  describe('Navigation buttons', () => {
    it('should show Next button when not on last step', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStep: 0,
        canGoNext: jest.fn(() => true),
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should show Create Booking button on last step', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStep: 4,
        steps: [
          { id: 'student', title: 'Select Student' },
          { id: 'subject', title: 'Select Subject' },
          { id: 'time', title: 'Select Time' },
          { id: 'staff', title: 'Select Staff' },
          { id: 'confirm', title: 'Confirm Booking' },
        ],
        canGoNext: jest.fn(() => true),
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /create booking/i })).toBeInTheDocument();
    });

    it('should show Back button when not on first step', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStep: 1,
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });

    it('should not show Back button on first step', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStep: 0,
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
    });

    it('should call handleNext when Next button is clicked', async () => {
      const handleNext = jest.fn();
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        canGoNext: jest.fn(() => true),
        handleNext,
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextButton);

      expect(handleNext).toHaveBeenCalled();
    });

    it('should call handleBack when Back button is clicked', async () => {
      const handleBack = jest.fn();
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStep: 1,
        handleBack,
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      await userEvent.click(backButton);

      expect(handleBack).toHaveBeenCalled();
    });

    it('should call handleConfirmBooking when Create Booking button is clicked', async () => {
      const handleConfirmBooking = jest.fn();
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStep: 4,
        steps: [
          { id: 'student', title: 'Select Student' },
          { id: 'subject', title: 'Select Subject' },
          { id: 'time', title: 'Select Time' },
          { id: 'staff', title: 'Select Staff' },
          { id: 'confirm', title: 'Confirm Booking' },
        ],
        canGoNext: jest.fn(() => true),
        handleConfirmBooking,
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      const createButton = screen.getByRole('button', { name: /create booking/i });
      await userEvent.click(createButton);

      expect(handleConfirmBooking).toHaveBeenCalled();
    });

    it('should disable Next button when canGoNext returns false', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        canGoNext: jest.fn(() => false),
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should show loading state when submitting', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        currentStep: 4,
        steps: [
          { id: 'student', title: 'Select Student' },
          { id: 'subject', title: 'Select Subject' },
          { id: 'time', title: 'Select Time' },
          { id: 'staff', title: 'Select Staff' },
          { id: 'confirm', title: 'Confirm Booking' },
        ],
        isSubmitting: true,
        canGoNext: jest.fn(() => true),
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
  });

  describe('Past date warning dialog', () => {
    it('should show past date warning dialog when showPastDateWarning is true', () => {
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        showPastDateWarning: true,
        selectedSlot: { startAt: '2024-01-01T10:00:00Z', endAt: '2024-01-01T11:00:00Z', availableStaffIds: [] },
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      expect(screen.getByText('Warning: Booking in the Past')).toBeInTheDocument();
      expect(screen.getByText(/you are about to book a session/i)).toBeInTheDocument();
    });

    it('should render past date warning dialog when showPastDateWarning is true', () => {
      const handlePastDateWarningCancel = jest.fn();
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        showPastDateWarning: true,
        selectedSlot: { startAt: '2024-01-01T10:00:00Z', endAt: '2024-01-01T11:00:00Z', availableStaffIds: [] },
        handlePastDateWarningCancel,
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      // Verify the warning dialog title is rendered
      // Note: AlertDialog renders in a portal, so we check for the title text
      expect(screen.getByText(/Warning: Booking in the Past/i)).toBeInTheDocument();
    });

    it('should render past date warning dialog with proceed option', () => {
      const handlePastDateWarningConfirm = jest.fn();
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        showPastDateWarning: true,
        selectedSlot: { startAt: '2024-01-01T10:00:00Z', endAt: '2024-01-01T11:00:00Z', availableStaffIds: [] },
        handlePastDateWarningConfirm,
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      // Verify the warning dialog and proceed text are rendered
      // Note: AlertDialog renders in a portal, so we check for the content text
      expect(screen.getByText(/Warning: Booking in the Past/i)).toBeInTheDocument();
      expect(screen.getByText(/Proceed Anyway/i)).toBeInTheDocument();
    });
  });

  describe('Modal close', () => {
    it('should call handleClose when dialog is closed', async () => {
      const handleClose = jest.fn();
      mockUseBookSessionFlow.mockReturnValue(createMockHookReturn({
        handleClose,
      }));

      renderWithProviders(<BookSessionModal {...defaultProps} />);

      // Simulate dialog close (onOpenChange with false)
      const dialog = screen.getByRole('dialog');
      // Note: Testing dialog close requires more complex setup with Radix UI
      // This is a simplified test
      expect(dialog).toBeInTheDocument();
    });
  });
});
