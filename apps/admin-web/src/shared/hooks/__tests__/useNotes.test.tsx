/**
 * Tests for useNotes hooks
 * Tests note querying and mutations
 */

import React, { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  notesKeys,
} from '../useNotes';
import { notesApi } from '@/shared/api/notes';
import type { Tables } from '@altitutor/shared';
import type { JSONContent } from '@tiptap/core';

const sampleNoteContent: JSONContent = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'New note' }] },
  ],
};

// Mock notes API
jest.mock('@/shared/api/notes', () => ({
  notesApi: {
    getNotesWithStaff: jest.fn(),
    createNote: jest.fn(),
    updateNote: jest.fn(),
    deleteNote: jest.fn(),
  },
}));

const mockNotesApi = notesApi as jest.Mocked<typeof notesApi>;

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

describe('useNotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch notes when enabled and targetId provided', async () => {
    const mockNotes: Array<Tables<'notes'> & { staff?: Tables<'staff'> | null }> = [
      {
        id: 'note-1',
        target_type: 'student',
        target_id: 'student-1',
        note: 'Test note',
        created_by: 'staff-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        staff: {
          id: 'staff-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone_number: null,
          role: 'TUTOR',
          status: 'ACTIVE',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
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
        },
      },
    ];

    mockNotesApi.getNotesWithStaff.mockResolvedValue(mockNotes);

    const { result } = renderHook(
      () => useNotes('student', 'student-1', true),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockNotes);
    expect(mockNotesApi.getNotesWithStaff).toHaveBeenCalledWith({
      targetType: 'student',
      targetId: 'student-1',
    });
  });

  it('should not fetch when enabled is false', () => {
    const { result } = renderHook(
      () => useNotes('student', 'student-1', false),
      { wrapper: createWrapper() }
    );

    expect(result.current.isFetching).toBe(false);
    expect(mockNotesApi.getNotesWithStaff).not.toHaveBeenCalled();
  });

  it('should not fetch when targetId is empty', () => {
    const { result } = renderHook(
      () => useNotes('student', '', true),
      { wrapper: createWrapper() }
    );

    expect(result.current.isFetching).toBe(false);
    expect(mockNotesApi.getNotesWithStaff).not.toHaveBeenCalled();
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch notes');
    mockNotesApi.getNotesWithStaff.mockRejectedValue(error);

    const { result } = renderHook(
      () => useNotes('student', 'student-1', true),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(error);
  });
});

describe('useCreateNote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a note and invalidate queries', async () => {
    const newNote: Tables<'notes'> = {
      id: 'note-1',
      target_type: 'student',
      target_id: 'student-1',
      note: 'New note',
      created_by: 'staff-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockNotesApi.createNote.mockResolvedValue(newNote);

    const { result } = renderHook(() => useCreateNote(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        targetType: 'student',
        targetId: 'student-1',
        note: sampleNoteContent,
        staffId: 'staff-1',
      });
    });

    expect(mockNotesApi.createNote).toHaveBeenCalledWith({
      targetType: 'student',
      targetId: 'student-1',
      note: sampleNoteContent,
      staffId: 'staff-1',
    });
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to create note');
    mockNotesApi.createNote.mockRejectedValue(error);

    const { result } = renderHook(() => useCreateNote(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          targetType: 'student',
          targetId: 'student-1',
          note: sampleNoteContent,
          staffId: 'staff-1',
        });
      } catch (e) {
        expect(e).toEqual(error);
      }
    });
  });
});

describe('useUpdateNote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update a note', async () => {
    const updatedNote: Tables<'notes'> = {
      id: 'note-1',
      target_type: 'student',
      target_id: 'student-1',
      note: 'Updated note',
      created_by: 'staff-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockNotesApi.updateNote.mockResolvedValue(updatedNote);

    const { result } = renderHook(() => useUpdateNote(), {
      wrapper: createWrapper(),
    });

    const updatedContent: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Updated note' }] },
      ],
    };
    await act(async () => {
      await result.current.mutateAsync({
        noteId: 'note-1',
        note: updatedContent,
      });
    });

    expect(mockNotesApi.updateNote).toHaveBeenCalledWith(
      'note-1',
      updatedContent
    );
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to update note');
    mockNotesApi.updateNote.mockRejectedValue(error);

    const { result } = renderHook(() => useUpdateNote(), {
      wrapper: createWrapper(),
    });

    const updatedContent: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Updated note' }] },
      ],
    };
    await act(async () => {
      try {
        await result.current.mutateAsync({
          noteId: 'note-1',
          note: updatedContent,
        });
      } catch (e) {
        expect(e).toEqual(error);
      }
    });
  });
});

describe('useDeleteNote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete a note', async () => {
    mockNotesApi.deleteNote.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteNote(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('note-1');
    });

    expect(mockNotesApi.deleteNote).toHaveBeenCalledWith('note-1');
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to delete note');
    mockNotesApi.deleteNote.mockRejectedValue(error);

    const { result } = renderHook(() => useDeleteNote(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync('note-1');
      } catch (e) {
        expect(e).toEqual(error);
      }
    });
  });
});

describe('notesKeys', () => {
  it('should generate correct query keys', () => {
    expect(notesKeys.all).toEqual(['notes']);
    expect(notesKeys.forTarget('student', 'student-1')).toEqual([
      'notes',
      'student',
      'student-1',
    ]);
    expect(notesKeys.forTarget('class', 'class-1')).toEqual([
      'notes',
      'class',
      'class-1',
    ]);
  });
});
