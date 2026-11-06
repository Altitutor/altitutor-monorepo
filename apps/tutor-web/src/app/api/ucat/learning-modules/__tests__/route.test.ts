/** @jest-environment node */
import { NextRequest } from 'next/server'
import { POST } from '../route'

const mockRpc = jest.fn()
const mockGetClaims = jest.fn()
jest.mock('@/shared/lib/supabase/server-ssr', () => ({
  createClient: () => ({ auth: { getClaims: mockGetClaims }, rpc: mockRpc }),
}))

beforeEach(() => {
  mockGetClaims.mockReset()
  mockGetClaims.mockResolvedValue({ data: { claims: { sub: 'tutor-1' } }, error: null })
  mockRpc.mockReset()
  mockRpc.mockImplementation(async (name: string) => ({ data: name === 'is_ucat_tutor' ? true : 'lesson-id', error: null }))
})

async function save(body: Record<string, unknown>) {
  return POST(new NextRequest('https://example.test/api/ucat/learning-modules', { method: 'POST', body: JSON.stringify(body) }))
}

it('round-trips explicit general placement through the authenticated save boundary', async () => {
  const response = await save({kind: 'lesson', title: 'Transition lesson', journeyPlacement: 'pre_exam', ucatSectionId: null})
  expect(response.status).toBe(200)
  expect(mockRpc).toHaveBeenCalledWith('tutor_ucat_upsert_learning_module', expect.objectContaining({p_journey_placement: 'pre_exam', p_set_journey_placement: true}))
})

it('rejects a general placement attached to a cognitive section before saving', async () => {
  const response = await save({kind: 'lesson', title: 'Invalid lesson', journeyPlacement: 'orientation', ucatSectionId: 'vr'})
  expect(response.status).toBe(400)
  expect(mockRpc.mock.calls.map(([name]) => name)).toEqual(['is_ucat_tutor'])
})

it('rejects an absent session before requesting tutor access or writing', async () => {
  mockGetClaims.mockResolvedValue({
    data: null,
    error: { name: 'AuthSessionMissingError' },
  })
  mockRpc.mockResolvedValue({
    data: null,
    error: {
      code: '42501',
      message: 'permission denied for function is_ucat_tutor',
    },
  })

  const response = await save({ kind: 'lesson', title: 'Missing session' })

  expect(response.status).toBe(401)
  expect(mockRpc).not.toHaveBeenCalled()
})

it.each([
  [{ code: 'bad_jwt' }, 401],
  [{ code: 'invalid_jwt', name: 'AuthInvalidJwtError' }, 401],
  [{ code: 'bad_jwt', message: 'JWT issued at future' }, 500],
  [{ status: 503 }, 500],
])('keeps auth failures out of the tutor RPC (%j)', async (error, status) => {
  mockGetClaims.mockResolvedValue({ data: null, error })

  const response = await save({ kind: 'lesson', title: 'Unverified session' })

  expect(response.status).toBe(status)
  expect(mockRpc).not.toHaveBeenCalled()
})

it('continues to forbid authenticated callers without UCAT tutor eligibility', async () => {
  mockRpc.mockResolvedValue({ data: false, error: null })

  const response = await save({ kind: 'lesson', title: 'Ineligible tutor' })

  expect(response.status).toBe(403)
  expect(mockRpc.mock.calls.map(([name]) => name)).toEqual(['is_ucat_tutor'])
})
