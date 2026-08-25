import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { useAuthStore } from '@/shared/lib/supabase/auth'

async function getUcatAccess(): Promise<boolean> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>
  const { data, error } = await supabase.rpc('is_ucat_tutor')
  if (error) throw error
  return !!data
}

export function useUcatAccess() {
  const { user, loading } = useAuthStore()

  return useQuery({
    queryKey: ucatKeys.access(),
    queryFn: getUcatAccess,
    enabled: !loading && Boolean(user),
    staleTime: 60_000,
  })
}
