import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { GeneratedContentBlockSchema } from '@/features/ucat/questions/lib/ai-generation/schema'
import { generatedVisualBlockToImageNodeServer } from '@/features/ucat/questions/lib/ai-generation/server-content-blocks'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const parsed = GeneratedContentBlockSchema.safeParse(await request.json())
    if (!parsed.success || parsed.data.type !== 'visual') {
      return NextResponse.json({ error: 'A valid deterministic visual is required.' }, { status: 400 })
    }

    const imageNode = await generatedVisualBlockToImageNodeServer(parsed.data)
    return NextResponse.json({ imageNode })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Visual rendering failed.' },
      { status: 400 },
    )
  }
}
