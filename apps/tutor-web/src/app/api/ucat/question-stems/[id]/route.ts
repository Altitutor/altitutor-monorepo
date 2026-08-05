import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { enqueueUcatQuestionAssessmentPreparation } from '@/features/ucat/questions/server/ai-assessment/dispatcher'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const client = access.userClient as unknown as UcatTutorSupabaseClient

    const rpcName = typeof body.expectedUpdatedAt === 'string'
      ? 'tutor_ucat_update_question_stem_bundle_revisioned'
      : 'tutor_ucat_upsert_question_stem_bundle'
    const { data, error } = await client.rpc(rpcName, {
      p_stem_id: params.id,
      ...(typeof body.expectedUpdatedAt === 'string'
        ? { p_expected_updated_at: body.expectedUpdatedAt }
        : {}),
      p_section_id: body.sectionId,
      p_question_stem_category_id: body.categoryId ?? null,
      p_stem_text: body.stemText ?? {},
      p_access_scope: body.accessScope ?? 'public',
      p_questions: body.questions ?? [],
      p_source_channel: body.sourceChannel ?? null,
      p_tutor_source_note: body.tutorSourceNote ?? null,
    })

    if (error) {
      if (error.message.includes('question_stem_stale_revision')) {
        return NextResponse.json(
          { error: 'This question changed after you opened it. Reopen the editor to review the saved changes before saving again.' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (body.requestAssessment !== false) {
      await enqueueUcatQuestionAssessmentPreparation({
        stemIds: [params.id],
        triggerKind: 'content_change',
      }).catch((assessmentError) => {
        console.error('Could not queue supplementary UCAT AI assessment preparation after stem save', assessmentError)
      })
    }
    return NextResponse.json({ id: data })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { error } = await client.rpc('tutor_ucat_delete_question_stem', { p_stem_id: params.id })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
