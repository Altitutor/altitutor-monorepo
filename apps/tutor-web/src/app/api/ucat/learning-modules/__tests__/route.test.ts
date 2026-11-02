/** @jest-environment node */
import { NextRequest } from 'next/server'
import { POST } from '../route'

const mockRpc = jest.fn()
jest.mock('@/shared/lib/supabase/server-ssr', () => ({ createClient: () => ({ rpc: mockRpc }) }))

beforeEach(() => {
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
