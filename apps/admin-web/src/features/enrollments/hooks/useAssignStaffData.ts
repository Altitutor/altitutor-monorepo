import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { AssignStaffContext } from '../types/enrollment';

interface UseAssignStaffDataProps {
  isOpen: boolean;
  step: 1 | 2 | 3;
  context: AssignStaffContext;
  searchQuery: string;
  dayFilters: number[];
  subjectFilters: string[];
  classData?: Tables<'classes'>;
  staff?: Tables<'staff'>;
}

export function useAssignStaffData({
  isOpen,
  step,
  context,
  searchQuery,
  dayFilters,
  subjectFilters,
  classData,
  staff: _staff,
}: UseAssignStaffDataProps) {
  // Fetch classes for staff context
  const { data: classes = [], isLoading: isFetchingClasses } = useQuery({
    queryKey: ['assignStaff', 'classes', searchQuery, dayFilters, subjectFilters],
    queryFn: async (): Promise<ClassWithExpandedSubject[]> => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const trimmed = searchQuery.trim();
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_classes_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: ['ACTIVE'],
        p_subject_ids: subjectFilters.length > 0 ? subjectFilters : undefined,
        p_include_relationships: true,
        p_exclude_student_search: false,
        p_exclude_staff_search: false,
        p_limit: 10000,
        p_offset: 0,
        p_order_by: 'day_of_week',
        p_ascending: true,
      });
      
      if (rpcError) throw rpcError;
      if (!rpcResult) return [];
      
      interface RPCClass {
        id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        status: string;
        room: string | null;
        subject_id: string | null;
        level: string | null;
      }
      
      interface RPCSubject {
        id: string;
        curriculum: string | null;
        year_level: number | null;
        name: string;
        discipline: string | null;
        level: string | null;
        color: string | null;
      }
      
      interface RPCStaff {
        id: string;
        first_name: string;
        last_name: string;
        role: string;
        status: string;
        email: string | null;
        phone_number: string | null;
      }
      
      interface RPCStudent {
        id: string;
        first_name: string;
        last_name: string;
        status: string;
        curriculum: string | null;
        year_level: number | null;
        school: string | null;
      }
      
      const rpcData = rpcResult as unknown as { 
        classes: RPCClass[]; 
        classSubjects: Record<string, RPCSubject>; 
        classStudents: Record<string, RPCStudent[]>; 
        classStaff: Record<string, RPCStaff[]>; 
        total: number 
      };
      
      const rpcClasses = rpcData.classes || [];
      
      // Filter by day if needed
      let filteredClasses = rpcClasses;
      if (dayFilters.length > 0) {
        filteredClasses = rpcClasses.filter(c => dayFilters.includes(c.day_of_week));
      }
      
      // Transform RPC response to match ClassWithExpandedSubject format
      return filteredClasses.map(c => ({
        id: c.id,
        day_of_week: c.day_of_week,
        start_time: c.start_time,
        end_time: c.end_time,
        status: c.status as Tables<'classes'>['status'],
        room: c.room,
        level: c.level,
        subject_id: c.subject_id,
        created_at: null,
        updated_at: null,
        created_by: null,
        session_start_date: null,
        session_end_date: null,
        subject: rpcData.classSubjects?.[c.id] as Tables<'subjects'> | undefined,
        staff: (rpcData.classStaff?.[c.id] || []).map((s) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          role: s.role as Tables<'staff'>['role'],
          status: s.status as Tables<'staff'>['status'],
          email: s.email || null,
          phone_number: s.phone_number || null,
          created_at: null,
          updated_at: null,
        })),
        students: (rpcData.classStudents?.[c.id] || []).map((s) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          status: s.status as Tables<'students'>['status'],
          curriculum: s.curriculum || null,
          year_level: s.year_level || null,
          school: s.school || null,
          email: null,
          phone: null,
          phone_number: null,
          created_at: null,
          updated_at: null,
        }))
      })) as unknown as ClassWithExpandedSubject[];
    },
    enabled: isOpen && step === 1 && context === 'staff',
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch staff for class context
  const { data: staffList = [], isLoading: isFetchingStaff } = useQuery({
    queryKey: ['assignStaff', 'staff', searchQuery, subjectFilters, classData?.id],
    queryFn: async (): Promise<Tables<'staff'>[]> => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const trimmed = searchQuery.trim();
      
      // If class context, filter by class subject
      const subjectIds = classData?.subject_id ? [classData.subject_id] : undefined;
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_staff_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: ['ACTIVE'],
        p_subject_ids: subjectIds || (subjectFilters.length > 0 ? subjectFilters : undefined),
        p_include_relationships: true,
        p_exclude_class_search: false,
        p_limit: 10000,
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });
      
      if (rpcError) throw rpcError;
      if (!rpcResult) return [];
      
      const rpcData = rpcResult as { staff: any[]; total: number };
      
      return (rpcData.staff || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        email: s.email || null,
        phone_number: s.phone_number || null,
        role: s.role as Tables<'staff'>['role'],
        status: s.status as Tables<'staff'>['status'],
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
        availability_monday: s.availability_monday ?? false,
        availability_tuesday: s.availability_tuesday ?? false,
        availability_wednesday: s.availability_wednesday ?? false,
        availability_thursday: s.availability_thursday ?? false,
        availability_friday: s.availability_friday ?? false,
        availability_saturday_am: s.availability_saturday_am ?? false,
        availability_saturday_pm: s.availability_saturday_pm ?? false,
        availability_sunday_am: s.availability_sunday_am ?? false,
        availability_sunday_pm: s.availability_sunday_pm ?? false,
        drafting_availability: s.drafting_availability ?? false,
        trial_session_availability: s.trial_session_availability ?? false,
        subsidy_interview_availability: s.subsidy_interview_availability ?? false,
      })) as Tables<'staff'>[];
    },
    enabled: isOpen && step === 1 && context === 'class',
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
    classes,
    staff: staffList,
    isFetching: isFetchingClasses || isFetchingStaff,
  };
}

