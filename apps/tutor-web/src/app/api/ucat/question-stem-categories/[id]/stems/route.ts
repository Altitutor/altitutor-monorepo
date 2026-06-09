import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const service = getServiceRoleClient()
  const { data, error } = await service
    .from('question_stems')
    .select(
      `
      id,
      stem_text,
      ucat_sections!inner (
        name
      )
    `
    )
    .eq('question_stem_category_id', params.id)
    .is('deleted_at', null)
    .order('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const stems = (data ?? [])
    .map((row) => {
      const section = row.ucat_sections as { name: string } | null
      if (!section) return null
      return {
        stemId: row.id,
        stemText: row.stem_text,
        sectionName: section.name,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.sectionName.localeCompare(b.sectionName))

  return NextResponse.json({ stems })
}
