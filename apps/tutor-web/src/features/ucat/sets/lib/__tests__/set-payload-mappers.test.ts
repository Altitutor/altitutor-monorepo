import { setDetailToUpdatePayload, type SetDetailLike } from '../set-payload-mappers'

const baseDetail = { section_id: 'section-id', reference_blueprint_id: 'blueprint-id', stems: [] }

describe('question-set timing overrides', () => {
  it.each([
    { timing_mode: 'pace', pace_multiplier: 1.5, fixed_time_limit_seconds: null },
    { timing_mode: 'fixed', pace_multiplier: null, fixed_time_limit_seconds: 300 },
  ] satisfies SetDetailLike[])('preserves explicit timing clears from %j', (timing) => {
    expect(setDetailToUpdatePayload({ ...baseDetail, ...timing }, {
      timingMode: 'untimed', paceMultiplier: null, fixedTimeLimitSeconds: null,
    })).toMatchObject({ timingMode: 'untimed', paceMultiplier: null, fixedTimeLimitSeconds: null })
  })

  it('preserves persisted timing when overrides are omitted', () => {
    expect(setDetailToUpdatePayload({ ...baseDetail, timing_mode: 'pace', pace_multiplier: 1.5 }, {
      authoringNote: 'Only the note changed',
    })).toMatchObject({ timingMode: 'pace', paceMultiplier: 1.5, fixedTimeLimitSeconds: null })
  })

  it('replaces fixed timing with a selected pace and clears the old duration', () => {
    expect(setDetailToUpdatePayload({ ...baseDetail, timing_mode: 'fixed', fixed_time_limit_seconds: 300 }, {
      timingMode: 'pace', paceMultiplier: 0.7, fixedTimeLimitSeconds: null,
    })).toMatchObject({ timingMode: 'pace', paceMultiplier: 0.7, fixedTimeLimitSeconds: null })
  })
})
