import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import { loadUcatAssessmentSnapshot } from '@/features/ucat/questions/server/ai-assessment/content'

type FakeRow = Record<string, unknown>
type FakeResult = { data: FakeRow[]; error: null }

class FakeQuery {
  private readonly filters: Array<(row: FakeRow) => boolean> = []

  constructor(private readonly rows: FakeRow[]) {}

  select() { return this }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]))
    return this
  }

  private matchingRows() {
    return this.rows.filter((row) => this.filters.every((filter) => filter(row)))
  }

  maybeSingle() {
    return Promise.resolve({ data: this.matchingRows()[0] ?? null, error: null })
  }

  single() {
    return Promise.resolve({ data: this.matchingRows()[0] ?? null, error: null })
  }

  then(
    onFulfilled?: (value: FakeResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) {
    return Promise.resolve({ data: this.matchingRows(), error: null } as FakeResult)
      .then(onFulfilled, onRejected)
  }
}

describe('assessment snapshot source', () => {
  it('loads service/background snapshots from base tables instead of the tutor-identity view', async () => {
    const stemId = '00000000-0000-0000-0000-000000000001'
    const sectionId = '00000000-0000-0000-0000-000000000002'
    const categoryId = '00000000-0000-0000-0000-000000000003'
    const questionId = '00000000-0000-0000-0000-000000000004'
    const optionId = '00000000-0000-0000-0000-000000000005'
    const tagId = '00000000-0000-0000-0000-000000000006'
    const calls: string[] = []
    const rows: Record<string, FakeRow[]> = {
      question_stems: [{
        id: stemId,
        section_id: sectionId,
        question_stem_category_id: categoryId,
        status: 'in_review',
        access_scope: 'public',
        stem_text: plainTextToProseMirror('Stem text'),
        deleted_at: null,
      }],
      ucat_sections: [{
        id: sectionId,
        section_number: 1,
        name: 'Verbal Reasoning',
        display_columns: 1,
      }],
      question_stem_categories: [{ id: categoryId, name: 'Reading comprehension' }],
      ucat_questions: [{
        id: questionId,
        question_stem_id: stemId,
        question_text: plainTextToProseMirror('Question text'),
        answer_explanation: plainTextToProseMirror('Teaching explanation'),
        index: 0,
        difficulty: 0.5,
        time_burden_seconds: 60,
        question_type: 'multiple_choice',
        deleted_at: null,
      }],
      question_answer_options: [{
        id: optionId,
        question_id: questionId,
        answer_text: plainTextToProseMirror('True'),
        answer_explanation: null,
        index: 0,
        is_answer: true,
        deleted_at: null,
      }],
      questions_question_tags: [{ question_id: questionId, tag_id: tagId }],
      question_tags: [{ id: tagId, name: 'Inference' }],
    }
    const client = {
      from(table: string) {
        calls.push(table)
        return new FakeQuery(rows[table] ?? [])
      },
    } as unknown as SupabaseClient<Database>

    const result = await loadUcatAssessmentSnapshot(client, stemId)

    expect(result).toMatchObject({
      stemId,
      status: 'in_review',
      sectionName: 'Verbal Reasoning',
      categoryName: 'Reading comprehension',
      questions: [{
        id: questionId,
        tagIds: [tagId],
        tagNames: ['Inference'],
        options: [{ id: optionId, isAnswer: true }],
      }],
    })
    expect(calls).toContain('question_stems')
    expect(calls).not.toContain('vtutor_ucat_question_stem_detail')
  })
})
