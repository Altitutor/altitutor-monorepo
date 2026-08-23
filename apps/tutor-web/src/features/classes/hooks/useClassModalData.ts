import { useState, useEffect, useCallback } from 'react';
import { classesApi } from '../api';
import { useToast } from '@altitutor/ui';
import type { Database, Tables } from '@altitutor/shared';

type VtutorClassDetailRow = Database['public']['Views']['vtutor_class_detail']['Row'];

function buildSubjectFromClassDetail(detail: VtutorClassDetailRow): Tables<'subjects'> | null {
  if (!detail.subject_id) return null;

  const displayParts: string[] = [];
  if (detail.subject_curriculum) displayParts.push(detail.subject_curriculum);
  if (detail.subject_year_level != null) displayParts.push(String(detail.subject_year_level));
  if (detail.subject_name) displayParts.push(detail.subject_name);
  if (detail.subject_level) displayParts.push(detail.subject_level);

  return {
    id: detail.subject_id,
    name: detail.subject_name ?? '',
    long_name: displayParts.join(' ') || detail.subject_name || '',
    short_name: null,
    curriculum: detail.subject_curriculum,
    discipline: detail.subject_discipline,
    level: detail.subject_level,
    color: detail.subject_color,
    year_level: detail.subject_year_level,
    created_at: null,
    updated_at: null,
  };
}

function buildClassFromClassDetail(detail: VtutorClassDetailRow): Tables<'classes'> | null {
  if (!detail.class_id) return null;

  return {
    id: detail.class_id,
    day_of_week: detail.day_of_week ?? 0,
    start_time: detail.start_time ?? '',
    end_time: detail.end_time ?? '',
    room: detail.room,
    level: detail.class_level,
    status: detail.class_status ?? 'ACTIVE',
    subject_id: detail.subject_id,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    created_by: null,
    session_start_date: detail.session_start_date ?? '',
    session_end_date: detail.session_end_date ?? '',
    short_name: detail.short_name,
    long_name: detail.long_name,
    cohort_label: detail.cohort_label,
    next_session_start_at: detail.next_session_start_at,
    schedule_rows: detail.schedule_rows ?? [],
    schedule_frequency_weeks: detail.schedule_frequency_weeks,
    schedule_anchor_date: detail.schedule_anchor_date,
    schedule_summary_long: detail.schedule_summary_long,
    schedule_summary_short: detail.schedule_summary_short,
    schedule_timezone: detail.schedule_timezone ?? 'Australia/Adelaide',
    schedule_weekdays: detail.schedule_weekdays ?? [],
  };
}

export interface UseClassModalDataProps {
  isOpen: boolean;
  classId: string | null;
}

export interface UseClassModalDataReturn {
  classDetail: VtutorClassDetailRow | null;
  students: Tables<'students'>[];
  staff: Tables<'staff'>[];
  classData: Tables<'classes'> | null;
  subject: Tables<'subjects'> | null;
  isLoading: boolean;
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
  const [classDetail, setClassDetail] = useState<VtutorClassDetailRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchClassData = useCallback(async () => {
    if (!classId) return;

    try {
      setIsLoading(true);

      const detail = await classesApi.getClassWithDetails(classId);

      if (!detail) {
        throw new Error('Class not found or you do not have access to it');
      }

      setClassDetail(detail);
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
      void fetchClassData();
    } else {
      setClassDetail(null);
    }
  }, [isOpen, classId, fetchClassData]);

  const refresh = async () => {
    await fetchClassData();
  };

  const students: Tables<'students'>[] =
    classDetail?.students && Array.isArray(classDetail.students)
      ? (classDetail.students as Tables<'students'>[])
      : [];

  const staff: Tables<'staff'>[] =
    classDetail?.staff && Array.isArray(classDetail.staff)
      ? (classDetail.staff as Tables<'staff'>[])
      : [];

  const classData = classDetail ? buildClassFromClassDetail(classDetail) : null;
  const subject = classDetail ? buildSubjectFromClassDetail(classDetail) : null;

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
