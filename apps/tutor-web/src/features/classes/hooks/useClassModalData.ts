import { useState, useEffect, useCallback } from 'react';
import { classesApi } from '../api';
import { useToast } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';

interface TutorClassDetailView {
  class_id: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  level: string | null;
  class_status: string | null;
  subject_id: string | null;
  subject_name: string | null;
  subject_color: string | null;
  students?: unknown;
  staff?: unknown;
}

export interface UseClassModalDataProps {
  isOpen: boolean;
  classId: string | null;
}

export interface UseClassModalDataReturn {
  // Data
  classDetail: TutorClassDetailView | null;
  students: Tables<'students'>[];
  staff: Tables<'staff'>[];
  classData: Tables<'classes'> | null;
  subject: Tables<'subjects'> | null;
  
  // State
  isLoading: boolean;
  
  // Actions
  refresh: () => Promise<void>;
}

/**
 * Hook for loading class modal data from vtutor_class_detail view
 * Handles fetching class details and parsing students/staff from JSON arrays
 */
export function useClassModalData({
  isOpen,
  classId,
}: UseClassModalDataProps): UseClassModalDataReturn {
  const [classDetail, setClassDetail] = useState<TutorClassDetailView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchClassData = useCallback(async () => {
    if (!classId) return;
    
    try {
      setIsLoading(true);
      
      // Get class details from vtutor_class_detail view
      const detail = await classesApi.getClassWithDetails(classId);
      
      if (!detail) {
        throw new Error('Class not found or you do not have access to it');
      }
      
      setClassDetail(detail as unknown as TutorClassDetailView);
    } catch (err) {
      console.error('Failed to fetch class:', err);
      toast({
        title: 'Error',
        description: 'Failed to load class details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [classId, toast]);

  useEffect(() => {
    if (isOpen && classId) {
      fetchClassData();
    } else {
      // Reset state when closing
      setClassDetail(null);
    }
  }, [isOpen, classId, fetchClassData]);

  const refresh = async () => {
    await fetchClassData();
  };

  // Parse students and staff from JSON arrays
  const students: Tables<'students'>[] = classDetail?.students && Array.isArray(classDetail.students)
    ? classDetail.students
    : [];
  
  const staff: Tables<'staff'>[] = classDetail?.staff && Array.isArray(classDetail.staff)
    ? classDetail.staff
    : [];

  // Build class object for compatibility
  const classData: Tables<'classes'> | null = classDetail && classDetail.class_id
    ? {
        id: classDetail.class_id,
        day_of_week: classDetail.day_of_week ?? 0,
        start_time: classDetail.start_time ?? '',
        end_time: classDetail.end_time ?? '',
        room: classDetail.room,
        level: classDetail.level,
        status: classDetail.class_status ?? 'ACTIVE',
        subject_id: classDetail.subject_id,
        created_at: null,
        updated_at: null,
        created_by: null,
        session_start_date: null,
        session_end_date: null,
      }
    : null;

  // Build subject object from flattened fields
  const subject: Tables<'subjects'> | null = classDetail?.subject_id
    ? {
        id: classDetail.subject_id,
        name: classDetail.subject_name ?? '',
        curriculum: null,
        discipline: null,
        level: null,
        color: classDetail.subject_color ?? null,
        year_level: null,
      } as Tables<'subjects'>
    : null;

  return {
    classDetail,
    students,
    staff,
    classData,
    subject,
    isLoading,
    refresh,
  };
}
