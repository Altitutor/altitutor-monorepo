/**
 * Tests for useBreadcrumbs hook
 * Tests breadcrumb generation from pathname
 */

import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBreadcrumbs } from '../useBreadcrumbs';
import { studentsApi } from '@/features/students/api';
import { staffApi } from '@/features/staff/api';
import { classesApi } from '@/features/classes/api';
import { subjectsApi } from '@/features/subjects/api';
import { topicsApi } from '@/features/topics/api';
import { usePathname } from 'next/navigation';
import type { Tables } from '@altitutor/shared';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

// Mock API modules
jest.mock('@/features/students/api', () => ({
  studentsApi: {
    getStudent: jest.fn(),
  },
}));

jest.mock('@/features/staff/api', () => ({
  staffApi: {
    getStaff: jest.fn(),
  },
}));

jest.mock('@/features/classes/api', () => ({
  classesApi: {
    getClassWithDetails: jest.fn(),
  },
}));

jest.mock('@/features/sessions/api', () => ({
  sessionsApi: {
    getSessionWithTutorLog: jest.fn(),
  },
}));

jest.mock('@/features/subjects/api', () => ({
  subjectsApi: {
    getSubject: jest.fn(),
  },
}));

jest.mock('@/features/topics/api', () => ({
  topicsApi: {
    getTopic: jest.fn(),
  },
}));

const mockStudentsApi = studentsApi as jest.Mocked<typeof studentsApi>;
const mockStaffApi = staffApi as jest.Mocked<typeof staffApi>;
const mockClassesApi = classesApi as jest.Mocked<typeof classesApi>;
const mockSubjectsApi = subjectsApi as jest.Mocked<typeof subjectsApi>;
const mockTopicsApi = topicsApi as jest.Mocked<typeof topicsApi>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('useBreadcrumbs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return Dashboard for root path', () => {
    mockUsePathname.mockReturnValue('/dashboard');

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
    ]);
  });

  it('should return Dashboard for empty path', () => {
    mockUsePathname.mockReturnValue('/');

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
    ]);
  });

  it('should generate breadcrumbs for simple paths', () => {
    mockUsePathname.mockReturnValue('/students');

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Students', href: '/students' },
    ]);
  });

  it('should generate breadcrumbs for nested paths', () => {
    mockUsePathname.mockReturnValue('/students/staff/classes');

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Students', href: '/students' },
      { label: 'Staff', href: '/students/staff' },
      { label: 'Classes', href: '/students/staff/classes' },
    ]);
  });

  it('should convert kebab-case to Title Case', () => {
    mockUsePathname.mockReturnValue('/subject-overrides');

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Subject Overrides', href: '/subject-overrides' },
    ]);
  });

  it('should fetch and display student name for student UUID', async () => {
    const studentId = '123e4567-e89b-12d3-a456-426614174000';
    mockUsePathname.mockReturnValue(`/students/${studentId}`);

    mockStudentsApi.getStudent.mockResolvedValue({
      id: studentId,
      first_name: 'John',
      last_name: 'Doe',
      status: 'ACTIVE',
      curriculum: null,
      year_level: null,
      school: null,
      email: null,
      phone: null,
      created_at: null,
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
      user_id: null,
      invite_token: null,
    } as Tables<'students'>);

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const studentBreadcrumb = result.current.find(
        (item) => item.label === 'John Doe'
      );
      expect(studentBreadcrumb).toBeDefined();
    });

    expect(mockStudentsApi.getStudent).toHaveBeenCalledWith(studentId);
  });

  it('should fetch and display staff name for staff UUID', async () => {
    const staffId = '123e4567-e89b-12d3-a456-426614174001';
    mockUsePathname.mockReturnValue(`/staff/${staffId}`);

    mockStaffApi.getStaff.mockResolvedValue({
      id: staffId,
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      phone_number: null,
      role: 'TUTOR',
      status: 'ACTIVE',
      created_at: null,
      updated_at: null,
      invite_token: null,
      user_id: null,
      office_key_number: null,
      has_parking_remote: null,
      notes: null,
      availability_monday: null,
      availability_tuesday: null,
      availability_wednesday: null,
      availability_thursday: null,
      availability_friday: null,
      availability_saturday_am: null,
      availability_saturday_pm: null,
      availability_sunday_am: null,
      availability_sunday_pm: null,
      drafting_availability: null,
      trial_session_availability: null,
      subsidy_interview_availability: null,
      current_tier_number: 1,
      employment_started_at: '2024-01-01T00:00:00.000Z',
      metric_overrides: {},
    });

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const staffBreadcrumb = result.current.find(
        (item) => item.label === 'Jane Smith'
      );
      expect(staffBreadcrumb).toBeDefined();
    });

    expect(mockStaffApi.getStaff).toHaveBeenCalledWith(staffId);
  });

  it('should show truncated UUID while loading', () => {
    const studentId = '123e4567-e89b-12d3-a456-426614174000';
    mockUsePathname.mockReturnValue(`/students/${studentId}`);

    mockStudentsApi.getStudent.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves
        })
    );

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    const studentBreadcrumb = result.current.find((item) =>
      item.label.includes('...')
    );
    expect(studentBreadcrumb).toBeDefined();
    expect(studentBreadcrumb?.label).toContain('123e4567');
  });

  it('should handle invoice IDs without fetching', () => {
    const invoiceId = '123e4567-e89b-12d3-a456-426614174000';
    mockUsePathname.mockReturnValue(`/invoices/${invoiceId}`);

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Invoices', href: '/invoices' },
      { label: '123e4567...', href: undefined },
    ]);

    // Should not fetch invoice data
    expect(mockStudentsApi.getStudent).not.toHaveBeenCalled();
  });

  it('should handle subject and topic path', async () => {
    const subjectId = '123e4567-e89b-12d3-a456-426614174000';
    const topicId = '223e4567-e89b-12d3-a456-426614174000';
    mockUsePathname.mockReturnValue(`/subjects/${subjectId}/topics/${topicId}`);

    mockSubjectsApi.getSubject.mockResolvedValue({
      id: subjectId,
      name: 'Mathematics',
      short_name: 'MATH',
      long_name: 'SACE 12 Mathematics',
      curriculum: 'SACE',
      discipline: 'MATHEMATICS',
      year_level: 12,
      level: null,
      color: null,
      created_at: null,
      updated_at: null,
    });

    mockTopicsApi.getTopic.mockResolvedValue({
      id: topicId,
      name: 'Algebra',
      code: 'ALG',
      subject_id: subjectId,
      parent_id: null,
      index: 0,
      created_at: null,
      updated_at: null,
      created_by: null,
    });

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const subjectBreadcrumb = result.current.find((item) =>
        item.label.includes('MATH')
      );
      const topicBreadcrumb = result.current.find((item) =>
        item.label.includes('ALG')
      );
      expect(subjectBreadcrumb).toBeDefined();
      expect(topicBreadcrumb).toBeDefined();
    });
  });

  it('should handle errors gracefully when fetching entity names', async () => {
    const studentId = '123e4567-e89b-12d3-a456-426614174000';
    mockUsePathname.mockReturnValue(`/students/${studentId}`);

    mockStudentsApi.getStudent.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.length).toBeGreaterThan(1);
    });

    // Should show truncated UUID on error
    const studentBreadcrumb = result.current.find((item) =>
      item.label.includes('...')
    );
    expect(studentBreadcrumb).toBeDefined();
  });

  it('should handle class breadcrumbs', async () => {
    const classId = '123e4567-e89b-12d3-a456-426614174000';
    mockUsePathname.mockReturnValue(`/classes/${classId}`);

    mockClassesApi.getClassWithDetails.mockResolvedValue({
      class: {
        id: classId,
        subject_id: 'subject-1',
        day_of_week: 1,
        start_time: '14:00:00',
        end_time: '16:00:00',
        level: null,
        room: null,
        status: 'ACTIVE',
        session_start_date: null,
        session_end_date: null,
        created_at: null,
        updated_at: null,
        created_by: null,
        short_name: null,
        long_name: null,
      },
      subject: {
        id: 'subject-1',
        name: 'Mathematics',
        short_name: 'MATH',
        long_name: 'SACE 12 Mathematics',
        curriculum: 'SACE',
        discipline: 'MATHEMATICS',
        year_level: 12,
        level: null,
        color: null,
        created_at: null,
        updated_at: null,
      },
      students: [],
      staff: [],
    });

    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const classBreadcrumb = result.current.find((item) =>
        item.label.includes('MATH')
      );
      expect(classBreadcrumb).toBeDefined();
    });
  });
});
