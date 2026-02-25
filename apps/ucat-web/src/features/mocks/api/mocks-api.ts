import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export type StudentMockRow = {
  id: string
  name: string | null
  created_at: string | null
  updated_at: string | null
}

export async function getStudentMocks(): Promise<StudentMockRow[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('vstudent_ucat_mocks')
    .select('id,name,created_at,updated_at')
  if (error) throw new Error(error.message ?? 'Failed to load mocks')
  return (data ?? []) as StudentMockRow[]
}
