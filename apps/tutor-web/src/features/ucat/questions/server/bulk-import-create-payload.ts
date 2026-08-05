type ClientDraftOption = {
  id?: string | null
}

type ClientDraftQuestion<TOption extends ClientDraftOption> = {
  id?: string | null
  answer_options: TOption[]
}

type ClientDraftStem<TQuestion> = {
  stemId?: string | null
  questions: TQuestion[]
}

type CreateOption<TOption extends ClientDraftOption> = Omit<TOption, 'id'> & {
  id: null
}

type CreateQuestion<
  TOption extends ClientDraftOption,
  TQuestion extends ClientDraftQuestion<TOption>,
> = Omit<TQuestion, 'id' | 'answer_options'> & {
  id: null
  answer_options: Array<CreateOption<TOption>>
}

type CreateStem<
  TOption extends ClientDraftOption,
  TQuestion extends ClientDraftQuestion<TOption>,
  TStem extends ClientDraftStem<TQuestion>,
> = Omit<TStem, 'stemId' | 'questions'> & {
  stemId: null
  questions: Array<CreateQuestion<TOption, TQuestion>>
}

/**
 * Bulk import is create-only. The wizard's UUIDs identify unsaved rows in the
 * browser and must never reach an upsert RPC, where non-null IDs mean update.
 */
export function normalizeBulkImportCreatePayload<
  TOption extends ClientDraftOption,
  TQuestion extends ClientDraftQuestion<TOption>,
  TStem extends ClientDraftStem<TQuestion>,
>(stems: readonly TStem[]): Array<CreateStem<TOption, TQuestion, TStem>> {
  return stems.map((stem) => ({
    ...stem,
    stemId: null,
    questions: stem.questions.map((question) => ({
      ...question,
      id: null,
      answer_options: question.answer_options.map((option) => ({
        ...option,
        id: null,
      })),
    })),
  }))
}
