import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/lib/supabase/auth'
import { useResourceSubjectNavItems } from '@/features/resources/hooks/useResources'
import { useUcatAccess } from '../useUcatAccess'

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}))

jest.mock('@/shared/lib/supabase/auth', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}))

const mockUseQuery = jest.mocked(useQuery)
const mockUseAuthStore = jest.mocked(useAuthStore)

describe('authenticated tutor navigation queries', () => {
  beforeEach(() => {
    mockUseQuery.mockReset()
    mockUseAuthStore.mockReset()
  })

  it.each([
    ['UCAT access', useUcatAccess],
    ['resource subjects', useResourceSubjectNavItems],
  ])('does not run the %s query without an authenticated user', (_label, useQueryHook) => {
    mockUseAuthStore.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuthStore>)

    useQueryHook()

    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  })

  it.each([
    ['UCAT access', useUcatAccess],
    ['resource subjects', useResourceSubjectNavItems],
  ])('enables the %s query once authentication is ready', (_label, useQueryHook) => {
    mockUseAuthStore.mockReturnValue({
      user: { id: 'tutor-id' },
      loading: false,
    } as ReturnType<typeof useAuthStore>)

    useQueryHook()

    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
  })
})
