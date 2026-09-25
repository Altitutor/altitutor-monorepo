'use client';

import { FormAnswerer } from '@altitutor/ui';
import { validateFormAnswers, type FormAnswerPayload, type FormBlock } from '@altitutor/shared';

export const SUBSIDY_APPLICATION_FORM_ID = 'subsidy-application';

export function SubsidyApplicationStep({
  name,
  blocks,
  initialAnswers,
  onComplete,
}: {
  name: string;
  blocks: FormBlock[];
  initialAnswers: FormAnswerPayload | null;
  onComplete: (answers: FormAnswerPayload) => void;
}) {
  return (
    <FormAnswerer
      title={name}
      blocks={blocks}
      formId={SUBSIDY_APPLICATION_FORM_ID}
      hideSubmitButton
      completeOnSubmit={false}
      className="mx-0 max-w-none px-0 py-0"
      initialAnswers={initialAnswers ?? undefined}
      onSubmit={(answers) => {
        const errors = validateFormAnswers(blocks, answers);
        if (errors.length) throw new Error(errors[0]);
        onComplete(answers);
      }}
    />
  );
}
