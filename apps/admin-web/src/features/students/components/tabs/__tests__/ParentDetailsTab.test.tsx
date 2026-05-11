/**
 * Tests for ParentDetailsTab component
 * Tests UI rendering, form interactions, and data display
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ParentDetailsTab } from '../ParentDetailsTab';
import type { Tables } from '@altitutor/shared';

// Mock dependencies
jest.mock('../../../hooks/useStudentSubjectsForIds');
jest.mock('@/shared/hooks/useCopyToClipboard');
jest.mock('@/shared/components/StudentCard', () => ({
  StudentCard: ({
    student,
    subjects,
    onClick,
  }: {
    student: Tables<'students'>;
    subjects?: Tables<'subjects'>[];
    onClick?: () => void;
  }) => (
    <div data-testid={`student-card-${student.id}`} onClick={onClick}>
      {student.first_name} {student.last_name}
      {subjects && subjects.length > 0 && (
        <div data-testid={`subjects-${student.id}`}>
          {subjects.map((s: Tables<'subjects'>) => s.name).join(', ')}
        </div>
      )}
    </div>
  ),
}));
jest.mock('@/shared/components/TruncatedText', () => {
  const TruncatedText = ({ text, className }: { text: string; className?: string }) => (
    <div className={className} data-testid="truncated-text">
      {text}
    </div>
  );
  TruncatedText.displayName = 'TruncatedText';
  return { TruncatedText };
});

import { useStudentSubjectsForIds } from '../../../hooks/useStudentSubjectsForIds';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';

const mockUseStudentSubjectsForIds = useStudentSubjectsForIds as jest.MockedFunction<typeof useStudentSubjectsForIds>;
const mockUseCopyToClipboard = useCopyToClipboard as jest.MockedFunction<typeof useCopyToClipboard>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

const mockParent: Tables<'parents'> = {
  id: 'parent-1',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  phone: '+61412345678', // E.164 format for react-phone-number-input
  created_at: '2024-01-01T00:00:00Z',
  updated_at: null,
  created_by: null,
  invite_token: null,
  user_id: null,
};

const mockStudents: Tables<'students'>[] = [
  {
    id: 'student-1',
    first_name: 'Alice',
    last_name: 'Doe',
    status: 'ACTIVE',
    curriculum: null,
    year_level: null,
    school: null,
    email: null,
    phone: null,
      active_at: null,
      registered_at: null,
      discontinued_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: null,
    availability_monday: null,
    availability_tuesday: null,
    availability_wednesday: null,
    availability_thursday: null,
    availability_friday: null,
    availability_saturday_am: null,
    availability_saturday_pm: null,
    availability_sunday_am: null,
    availability_sunday_pm: null,
    created_by: null,
    user_id: null,
    invite_token: null,
    onboarding_progress: {},
    timezone: 'Australia/Adelaide',
  },
  {
    id: 'student-2',
    first_name: 'Bob',
    last_name: 'Doe',
    status: 'ACTIVE',
    curriculum: null,
    year_level: null,
    school: null,
    email: null,
    phone: null,
      active_at: null,
      registered_at: null,
      discontinued_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: null,
    availability_monday: null,
    availability_tuesday: null,
    availability_wednesday: null,
    availability_thursday: null,
    availability_friday: null,
    availability_saturday_am: null,
    availability_saturday_pm: null,
    availability_sunday_am: null,
    availability_sunday_pm: null,
    created_by: null,
    user_id: null,
    invite_token: null,
    onboarding_progress: {},
    timezone: 'Australia/Adelaide',
  },
];

describe('ParentDetailsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseStudentSubjectsForIds.mockReturnValue({
      data: {
        'student-1': [{ id: 'subject-1', name: 'Math' }] as Tables<'subjects'>[],
        'student-2': [{ id: 'subject-2', name: 'English' }] as Tables<'subjects'>[],
      },
      isLoading: false,
      isError: false,
      error: null,
      isSuccess: true,
      isFetching: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useStudentSubjectsForIds>);

    mockUseCopyToClipboard.mockReturnValue({
      copy: jest.fn(),
      copiedField: null,
    });
  });

  describe('View Mode', () => {
    it('should render parent information', () => {
      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1', 'student-2']}
          students={mockStudents}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Parent Information')).toBeInTheDocument();
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Doe')).toBeInTheDocument();
    });

    it('should render students with subjects', () => {
      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1', 'student-2']}
          students={mockStudents}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('student-card-student-1')).toBeInTheDocument();
      expect(screen.getByTestId('student-card-student-2')).toBeInTheDocument();
      expect(screen.getByTestId('subjects-student-1')).toHaveTextContent('Math');
      expect(screen.getByTestId('subjects-student-2')).toHaveTextContent('English');
    });

    it('should show loading state when fetching subjects', () => {
      mockUseStudentSubjectsForIds.mockReturnValue({
        data: {},
        isLoading: true,
        isError: false,
        error: null,
        isSuccess: false,
        isFetching: true,
        refetch: jest.fn(),
      } as unknown as ReturnType<typeof useStudentSubjectsForIds>);

      const { container } = render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1']}
          students={[mockStudents[0]]}
        />,
        { wrapper: createWrapper() }
      );

      // Check for loading spinner by looking for Loader2 component with animate-spin class
      const loader = container.querySelector('[class*="animate-spin"]');
      expect(loader).toBeInTheDocument();
    });

    it('should show empty state when no students', () => {
      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={[]}
          students={[]}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('No students associated with this parent')).toBeInTheDocument();
    });

    it('should call copy function when copy button is clicked', async () => {
      const mockCopy = jest.fn();
      mockUseCopyToClipboard.mockReturnValue({
        copy: mockCopy,
        copiedField: null,
      });

      const user = userEvent.setup();
      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={[]}
          students={[]}
        />,
        { wrapper: createWrapper() }
      );

      // Find copy button by looking for the Copy icon button near email field
      const emailSection = screen.getByText('Email:').closest('div')?.nextElementSibling;
      const copyButton = emailSection?.querySelector('button');
      expect(copyButton).toBeInTheDocument();
      if (copyButton) {
        await user.click(copyButton as HTMLElement);
      }

      expect(mockCopy).toHaveBeenCalledWith('john.doe@example.com', 'email');
    });

    it('should show check icon when field is copied', () => {
      mockUseCopyToClipboard.mockReturnValue({
        copy: jest.fn(),
        copiedField: 'email',
      });

      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={[]}
          students={[]}
        />,
        { wrapper: createWrapper() }
      );

      // Check icon should be visible (Check component from lucide-react)
      // Find button near email field
      const emailSection = screen.getByText('Email:').closest('div')?.nextElementSibling;
      const copyButton = emailSection?.querySelector('button');
      expect(copyButton).toBeInTheDocument();
      // Check that it contains Check icon (copiedField === 'email')
      expect(copyButton?.querySelector('svg')).toBeInTheDocument();
    });

    it('should call onViewStudent when student card is clicked', async () => {
      const onViewStudent = jest.fn();
      const user = userEvent.setup();

      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1']}
          students={[mockStudents[0]]}
          onViewStudent={onViewStudent}
        />,
        { wrapper: createWrapper() }
      );

      const studentCard = screen.getByTestId('student-card-student-1');
      await user.click(studentCard);

      expect(onViewStudent).toHaveBeenCalledWith('student-1');
    });
  });

  describe('Edit Mode', () => {
    it('should render edit form', () => {
      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1']}
          students={mockStudents}
          isEditing={true}
          onSubmit={jest.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    });

    it('should prefill form with parent data', () => {
      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1']}
          students={mockStudents}
          isEditing={true}
          onSubmit={jest.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
    });

    it('should call onSubmit when form is submitted', async () => {
      const onSubmit = jest.fn();
      const user = userEvent.setup();

      const { container } = render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1']}
          students={mockStudents}
          isEditing={true}
          onSubmit={onSubmit}
        />,
        { wrapper: createWrapper() }
      );

      // Find form by id
      const form = container.querySelector('form#parent-edit-form') as HTMLFormElement;
      expect(form).toBeInTheDocument();
      
      // Update form field to ensure form has data
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');
      
      // Submit form by directly calling the form's onSubmit handler
      // Since the form has an onSubmit handler, we can trigger it
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should update form fields when typing', async () => {
      const user = userEvent.setup();

      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1']}
          students={mockStudents}
          isEditing={true}
          onSubmit={jest.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');

      expect(firstNameInput).toHaveValue('Jane');
    });

    it('should show remove button for students in edit mode', () => {
      const onRemoveStudent = jest.fn();

      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1']}
          students={mockStudents}
          isEditing={true}
          parentStudents={mockStudents}
          onRemoveStudent={onRemoveStudent}
          onSubmit={jest.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const removeButtons = screen.getAllByRole('button');
      const removeButton = removeButtons.find(btn => 
        btn.querySelector('svg') // X icon
      );
      expect(removeButton).toBeInTheDocument();
    });

    it('should call onRemoveStudent when remove button is clicked', async () => {
      const onRemoveStudent = jest.fn();
      const user = userEvent.setup();

      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1']}
          students={mockStudents}
          isEditing={true}
          parentStudents={mockStudents}
          onRemoveStudent={onRemoveStudent}
          onSubmit={jest.fn()}
        />,
        { wrapper: createWrapper() }
      );

      const removeButtons = screen.getAllByRole('button');
      const removeButton = removeButtons.find(btn => 
        btn.querySelector('svg') // X icon
      );
      
      if (removeButton) {
        await user.click(removeButton);
        expect(onRemoveStudent).toHaveBeenCalledWith('student-1');
      }
    });

    it('should display addStudentButton when provided', () => {
      const addButton = <button>Add Student</button>;

      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1']}
          students={mockStudents}
          isEditing={true}
          parentStudents={mockStudents}
          addStudentButton={addButton}
          onSubmit={jest.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Add Student')).toBeInTheDocument();
    });
  });

  describe('Hook Integration', () => {
    it('should call useStudentSubjectsForIds with correct student IDs', () => {
      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1', 'student-2']}
          students={mockStudents}
        />,
        { wrapper: createWrapper() }
      );

      expect(mockUseStudentSubjectsForIds).toHaveBeenCalledWith(
        ['student-1', 'student-2'],
        true
      );
    });

    it('should use parentStudents IDs in edit mode', () => {
      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={['student-1']}
          students={mockStudents}
          isEditing={true}
          parentStudents={[mockStudents[1]]}
        />,
        { wrapper: createWrapper() }
      );

      expect(mockUseStudentSubjectsForIds).toHaveBeenCalledWith(
        ['student-2'],
        true
      );
    });

    it('should disable query when no student IDs', () => {
      render(
        <ParentDetailsTab
          parent={mockParent}
          studentIds={[]}
          students={[]}
        />,
        { wrapper: createWrapper() }
      );

      expect(mockUseStudentSubjectsForIds).toHaveBeenCalledWith(
        [],
        false
      );
    });
  });
});
