import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, ClassWithExpandedSubject } from '@altitutor/shared';

interface UseChangeClassDataProps {
  isOpen: boolean;
  step: 1 | 2 | 3;
  oldClassSubjectId: string | null | undefined;
  searchQuery: string;
}

export function useChangeClassData({
  isOpen,
  step,
  oldClassSubjectId,
  searchQuery,
}: UseChangeClassDataProps) {
  const { data: classes = [], isLoading: isFetching } = useQuery({
    queryKey: ['changeClass', 'classes', oldClassSubjectId, searchQuery],
    queryFn: async (): Promise<ClassWithExpandedSubject[]> => {
      if (!oldClassSubjectId) return [];
      
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const trimmed = searchQuery.trim();
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_classes_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: ['ACTIVE'],
        p_subject_ids: [oldClassSubjectId], // Filter by same subject as old class
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
      
      // Transform RPC response to match ClassWithExpandedSubject format
      return rpcClasses.map(c => ({
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
    enabled: isOpen && step === 1 && !!oldClassSubjectId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
    classes,
    isFetching,
  };
}

