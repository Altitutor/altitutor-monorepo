import {
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
