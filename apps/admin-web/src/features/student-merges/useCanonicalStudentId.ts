import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/shared/lib/supabase/client";

export function useCanonicalStudentId(
  studentId: string | null,
  enabled = true,
): string | null {
  const query = useQuery({
    queryKey: ["canonical-student", studentId],
    enabled: enabled && Boolean(studentId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "resolve_merged_student_id",
        { p_student_id: studentId! },
      );
      if (error) throw error;
      return data;
    },
  });
  return query.data ?? (query.isError ? studentId : null);
}
