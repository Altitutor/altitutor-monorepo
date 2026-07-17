import {
  forkChangedFormQuestions,
  getChangedFormQuestionIds,
  getFormQuestionReportingSignature,
  getFormModelOptionSources,
  resolveFormModelOptions,
  validateFormAnswers,
  validateFormDefinition,
} from './schema';
import type { FormBlock } from './types';

const blocks: FormBlock[] = [
  {
    id: 'tutor',
    type: 'single_choice',
    title: 'Who is your tutor?',
    required: true,
    optionSource: { kind: 'model', source: 'staff' },
    options: [],
  },
  {
    id: 'other-tutor',
    type: 'multi_select',
    title: 'Other tutors',
    required: false,
    optionSource: { kind: 'model', source: 'staff' },
    options: [],
  },
];

describe('model-backed form choices', () => {
  it('publishes without storing model rows in the definition', () => {
    expect(validateFormDefinition({ blocks, thankYouMessage: 'Thanks' })).toEqual([]);
    expect(getFormModelOptionSources(blocks)).toEqual(['staff']);
  });

  it('loads each source once and hydrates every matching question', async () => {
    const loader = jest.fn().mockResolvedValue([{ id: 'staff_1', value: '1', label: 'Ada Tutor' }]);
    const hydrated = await resolveFormModelOptions(blocks, loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(hydrated[0]).toMatchObject({ options: [{ value: '1', label: 'Ada Tutor' }] });
    expect(hydrated[1]).toMatchObject({ options: [{ value: '1', label: 'Ada Tutor' }] });
  });

  it('rejects a submitted model id that is no longer available', async () => {
    const hydrated = await resolveFormModelOptions(blocks, async () => [
      { id: 'staff_1', value: '1', label: 'Ada Tutor' },
    ]);

    expect(validateFormAnswers(hydrated, { tutor: '2' })).toEqual([
      'Who is your tutor? contains an unavailable option.',
    ]);
  });
});

describe('form question reporting identity', () => {
  const published: FormBlock[] = [
    {
      id: 'rating',
      type: 'number',
      title: 'How was your session?',
      required: true,
      min: 1,
      max: 5,
      step: 1,
      display: 'rating',
    },
    {
      id: 'choice',
      type: 'single_choice',
      title: 'Would you recommend us?',
      required: true,
      optionSource: { kind: 'static' },
      options: [
        { id: 'yes', value: 'yes', label: 'Yes' },
        { id: 'no', value: 'no', label: 'No' },
      ],
    },
  ];

  it('keeps an identity when only question copy changes', () => {
    const draft = published.map((block) =>
      block.id === 'rating' ? { ...block, title: 'How was today\'s session?', description: 'Be honest.' } : block,
    );

    expect(getChangedFormQuestionIds(published, draft)).toEqual([]);
  });

  it('forks an identity when a numeric scale or choice meaning changes', () => {
    const draft = published.map((block) => {
      if (block.id === 'rating' && block.type === 'number') return { ...block, max: 10 };
      if (block.id === 'choice' && block.type === 'single_choice') {
        return { ...block, options: [{ ...block.options[0], label: 'Definitely' }, block.options[1]] };
      }
      return block;
    });

    expect(getChangedFormQuestionIds(published, draft)).toEqual(['rating', 'choice']);
    const forked = forkChangedFormQuestions(published, draft);
    expect(forked.changedQuestionIds).toEqual(['rating', 'choice']);
    expect(forked.blocks.map((block) => block.id)).not.toContain('rating');
    expect(forked.blocks.map((block) => block.id)).not.toContain('choice');
  });

  it('uses the definition signature to keep legacy incompatible versions apart', () => {
    const fivePoint = published[0];
    const tenPoint = { ...fivePoint, max: 10 };
    expect(getFormQuestionReportingSignature(fivePoint as Extract<FormBlock, { type: 'number' }>))
      .not.toEqual(getFormQuestionReportingSignature(tenPoint as Extract<FormBlock, { type: 'number' }>));
  });
});
