/** @jest-environment node */

import { NextRequest } from 'next/server'
import { DELETE } from '../route'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

jest.mock('@/features/ucat/shared/server/guard', () => ({
  requireUcatTutor: jest.fn(),
}))

describe('DELETE /api/ucat/question-sets/[id]/stems', () => {
  it('calls the narrow membership removal RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null })
    jest.mocked(requireUcatTutor).mockResolvedValue({
      ok: true,
      userClient: { rpc },
    } as never)

    const response = await DELETE(
      new NextRequest('http://localhost/api/ucat/question-sets/set-id/stems', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stemIds: ['a1300000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000002'],
        }),
      }),
      {
        params: Promise.resolve({ id: 'f3000000-0000-4000-8000-000000000001' }),
      },
    )

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('tutor_ucat_remove_question_set_stems', {
      p_set_id: 'f3000000-0000-4000-8000-000000000001',
      p_stem_ids: ['a1300000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000002'],
    })
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('rejects an empty membership removal', async () => {
    jest.mocked(requireUcatTutor).mockResolvedValue({
      ok: true,
      userClient: { rpc: jest.fn() },
    } as never)

    const response = await DELETE(
      new NextRequest('http://localhost/api/ucat/question-sets/set-id/stems', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stemIds: [] }),
      }),
      {
        params: Promise.resolve({ id: 'f3000000-0000-4000-8000-000000000001' }),
      },
    )

    expect(response.status).toBe(400)
  })
})
