/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

jest.mock('@/features/ucat/shared/server/guard', () => ({
  requireUcatTutor: jest.fn(),
}))

describe('POST /api/ucat/mocks/[id]/blueprint-audit', () => {
  it('returns not found when a stale editor targets a deleted mock', async () => {
    jest.mocked(requireUcatTutor).mockResolvedValue({
      ok: true,
      userClient: {
        rpc: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'mock_not_found' },
        }),
      },
    } as never)

    const response = await POST(
      new NextRequest('http://localhost/api/ucat/mocks/mock-id/blueprint-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprintId: 'blueprint-id' }),
      }),
      { params: { id: 'mock-id' } },
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'This mock no longer exists.',
    })
  })
})
