export function toPersistencePayload(stem: Record<string, unknown>): Record<string, unknown> {
  const questions = Array.isArray(stem.questions)
    ? stem.questions as Array<Record<string, unknown>>
    : []
  return {
    sectionId: stem.sectionId,
    categoryId: stem.categoryId ?? null,
    stemText: stem.stemText ?? {},
    accessScope: 'public',
    ai_generation_metadata: stem.aiGenerationMetadata ?? null,
    questions: questions.map((question) => {
      const responseType = question.responseType
      const answerScheme = question.answerScheme
      if (responseType !== 'multiple_choice' && responseType !== 'drag_and_drop') {
        throw new Error('Generated question is missing its canonical Response type.')
      }
      if (
        answerScheme !== 'single_choice'
        && answerScheme !== 'situational_judgement_rating'
        && answerScheme !== 'decision_making_binary_placement'
        && answerScheme !== 'situational_judgement_most_least'
      ) {
        throw new Error('Generated question is missing its canonical Answer scheme.')
      }
      const options = Array.isArray(question.options)
        ? question.options as Array<Record<string, unknown>>
        : []
      if (options.some((option) => !Object.prototype.hasOwnProperty.call(option, 'answerKeyValue'))) {
        throw new Error('Generated question is missing a canonical answer key.')
      }
      return {
        index: question.index,
        question_text: question.questionText ?? {},
        answer_explanation: question.answerExplanation ?? null,
        difficulty: question.difficulty ?? null,
        time_burden_seconds: question.timeBurdenSeconds ?? null,
        response_type: responseType,
        answer_scheme: answerScheme,
        source_channel: 'ai_generation',
        ai_generation_metadata: stem.aiGenerationMetadata ?? null,
        tag_ids: question.tagIds ?? [],
        answer_options: options.map((option) => ({
          index: option.index,
          answer_text: option.answerText ?? {},
          answer_explanation: option.answerExplanation ?? null,
          answer_key_value: option.answerKeyValue ?? null,
        })),
      }
    }),
  }
}
