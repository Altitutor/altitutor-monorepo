import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const service = getServiceRoleClient()
  const { data, error } = await service
    .from('questions_question_tags')
    .select(
      `
      question_id,
      ucat_questions!inner (
        id,
        index,
        question_text,
        question_stem_id,
        question_stems!inner (
          id,
          ucat_sections!inner (
            name
          )
        )
      )
    `
    )
    .eq('tag_id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const questions = (data ?? [])
    .map((row) => {
      const question = row.ucat_questions as {
        id: string
        index: number
        question_text: unknown
        question_stems: {
          id: string
          ucat_sections: { name: string }
        }
      } | null
      if (!question?.question_stems) return null
      return {
        questionId: question.id,
        questionIndex: question.index,
        questionText: question.question_text,
        stemId: question.question_stems.id,
        sectionName: question.question_stems.ucat_sections.name,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => {
      const sectionCompare = a.sectionName.localeCompare(b.sectionName)
      if (sectionCompare !== 0) return sectionCompare
      if (a.stemId !== b.stemId) return a.stemId.localeCompare(b.stemId)
      return a.questionIndex - b.questionIndex
    })

  return NextResponse.json({ questions })
}
