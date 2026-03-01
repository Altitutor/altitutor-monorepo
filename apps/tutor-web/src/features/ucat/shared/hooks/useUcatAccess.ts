import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

async function getUcatAccess(): Promise<boolean> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>
  const { data, error } = await supabase.rpc('is_ucat_tutor')
  if (error) throw error
  return !!data
}

export function useUcatAccess() {
  return useQuery({
    queryKey: ucatKeys.access(),
    queryFn: getUcatAccess,
    staleTime: 60_000,
  })
}
