import type {
  FormAnswerPayload,
  FormBlock,
  FormChoiceQuestion,
  FormDefinition,
  FormQuestion,
  NormalizedFormAnswer,
} from './types';

export const EMPTY_TIPTAP_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
} as const;

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultContentBlock(): FormBlock {
  return {
    id: createId('content'),
    type: 'content',
    title: '',
    body: EMPTY_TIPTAP_DOC,
    buttons: [],
  };
}

export function createDefaultQuestion(type: FormQuestion['type']): FormQuestion {
  const base = {
    id: createId('question'),
    title: 'Untitled question',
    description: '',
    required: false,
  };
  if (type === 'single_choice' || type === 'multi_select') {
    return {
      ...base,
      type,
      options: [
        { id: createId('option'), label: 'Option 1', value: 'option_1' },
        { id: createId('option'), label: 'Option 2', value: 'option_2' },
      ],
    };
  }
  if (type === 'number') {
    return { ...base, type, display: 'input', step: 1 };
  }
  return { ...base, type };
}

export function isQuestionBlock(block: FormBlock): block is FormQuestion {
  return block.type !== 'content';
}

export function isChoiceQuestion(block: FormBlock): block is FormChoiceQuestion {
  return block.type === 'single_choice' || block.type === 'multi_select';
}

export function validateFormDefinition(definition: FormDefinition): string[] {
  const errors: string[] = [];
  if (!Array.isArray(definition.blocks) || definition.blocks.length === 0) {
    errors.push('Add at least one block before publishing.');
    return errors;
  }
  const ids = new Set<string>();
  for (const [index, block] of definition.blocks.entries()) {
    if (!block.id || ids.has(block.id)) errors.push(`Block ${index + 1} needs a unique id.`);
    ids.add(block.id);
    if (block.type === 'content') {
      for (const button of block.buttons ?? []) {
        if (!button.label.trim()) errors.push(`Content block ${index + 1} has a button without a label.`);
        if (!isAllowedFormButtonHref(button.href)) {
          errors.push(`Content block ${index + 1} has an invalid button link.`);
        }
      }
      continue;
    }
    if (!block.title.trim()) errors.push(`Question ${index + 1} needs a title.`);
    if (isChoiceQuestion(block)) {
      if (block.options.length === 0) errors.push(`Question ${index + 1} needs at least one option.`);
      const values = new Set<string>();
      for (const option of block.options) {
        if (!option.label.trim()) errors.push(`Question ${index + 1} has an option without a label.`);
        if (!option.value.trim()) errors.push(`Question ${index + 1} has an option without a value.`);
        if (values.has(option.value)) errors.push(`Question ${index + 1} has duplicate option values.`);
        values.add(option.value);
      }
    }
  }
  return errors;
}

export function isAllowedFormButtonHref(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  return (
    value.startsWith('/') ||
    value.startsWith('https://') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:')
  );
}

export function validateFormAnswers(blocks: FormBlock[], answers: FormAnswerPayload): string[] {
  const errors: string[] = [];
  for (const block of blocks) {
    if (!isQuestionBlock(block)) continue;
    const value = answers[block.id];
    const empty =
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (block.required && empty) {
      errors.push(`${block.title} is required.`);
      continue;
    }
    if (empty) continue;
    if (block.type === 'single_choice' && typeof value !== 'string') {
      errors.push(`${block.title} must have one selected option.`);
    }
    if (block.type === 'multi_select' && !Array.isArray(value)) {
      errors.push(`${block.title} must have selected options.`);
    }
    if ((block.type === 'short_text' || block.type === 'long_text') && typeof value === 'string') {
      if (block.type === 'short_text' && value.includes('\n')) errors.push(`${block.title} cannot contain line breaks.`);
    }
    if (block.type === 'number') {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) errors.push(`${block.title} must be a number.`);
      if (block.min !== undefined && n < block.min) errors.push(`${block.title} is below the minimum.`);
      if (block.max !== undefined && n > block.max) errors.push(`${block.title} is above the maximum.`);
    }
  }
  return errors;
}

export function normalizeFormAnswers(
  blocks: FormBlock[],
  answers: FormAnswerPayload
): NormalizedFormAnswer[] {
  const normalized: NormalizedFormAnswer[] = [];
  for (const block of blocks) {
    if (!isQuestionBlock(block)) continue;
    const value = answers[block.id];
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    if (block.type === 'single_choice') {
      const selected = String(value);
      const option = block.options.find((o) => o.value === selected);
      normalized.push({
        questionId: block.id,
        questionLabelSnapshot: block.title,
        questionType: block.type,
        choiceValue: selected,
        choiceLabelSnapshot: option?.label ?? selected,
      });
      continue;
    }
    if (block.type === 'multi_select') {
      const selected = Array.isArray(value) ? value.map(String) : [String(value)];
      const choiceValues = selected.map((v) => {
        const option = block.options.find((o) => o.value === v);
        return { value: v, label: option?.label ?? v };
      });
      normalized.push({
        questionId: block.id,
        questionLabelSnapshot: block.title,
        questionType: block.type,
        choiceValues,
      });
      continue;
    }
    if (block.type === 'number') {
      normalized.push({
        questionId: block.id,
        questionLabelSnapshot: block.title,
        questionType: block.type,
        numberValue: Number(value),
      });
      continue;
    }
    normalized.push({
      questionId: block.id,
      questionLabelSnapshot: block.title,
      questionType: block.type,
      textValue: String(value),
    });
  }
  return normalized;
}
