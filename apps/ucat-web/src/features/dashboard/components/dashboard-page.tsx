'use client'

import { useQuery } from '@tanstack/react-query'
import { UcatPagePlaceholder } from '@altitutor/ui'

type SessionResponse = {
  user: {
    id: string
    email: string | null
  } | null
}

async function getSession(): Promise<SessionResponse> {
  const response = await fetch('/api/auth/session')
  if (!response.ok) {
    throw new Error('Failed to fetch session')
  }
  return response.json()
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: getSession,
  })

  return (
    <UcatPagePlaceholder title="Dashboard" description="UCAT dashboard placeholder content.">
      <p className="text-sm">
        {isLoading ? 'Checking auth session...' : `Signed in as: ${data?.user?.email ?? 'unknown user'}`}
      </p>
    </UcatPagePlaceholder>
  )
}
