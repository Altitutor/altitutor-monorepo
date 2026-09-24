import { nextAutoSetName, sectionNameAbbreviation } from '../next-auto-set-name'

describe('sectionNameAbbreviation', () => {
  it('uses initial letters from multi-word section names', () => {
    expect(sectionNameAbbreviation('Decision Making')).toBe('DM')
    expect(sectionNameAbbreviation('Verbal Reasoning')).toBe('VR')
    expect(sectionNameAbbreviation('Quantitative Reasoning')).toBe('QR')
    expect(sectionNameAbbreviation('Situational Judgement')).toBe('SJ')
  })
})

describe('nextAutoSetName', () => {
  it('starts at set 1 when the section has no sets', () => {
    expect(nextAutoSetName({ existingNamesNewestFirst: [], sectionName: 'Decision Making' })).toBe(
      'DM set 1',
    )
  })

  it('increments the trailing number on the last set name', () => {
    expect(
      nextAutoSetName({
        existingNamesNewestFirst: ['DM set 3', 'DM set 2', 'DM set 1'],
        sectionName: 'Decision Making',
      }),
    ).toBe('DM set 4')
  })

  it('skips names that are already used in the section', () => {
    expect(
      nextAutoSetName({
        existingNamesNewestFirst: ['DM set 3', 'DM set 4'],
        sectionName: 'Decision Making',
      }),
    ).toBe('DM set 5')
  })

  it('falls back to the section abbreviation when the last name has no number', () => {
    expect(
      nextAutoSetName({
        existingNamesNewestFirst: ['Practice pack'],
        sectionName: 'Verbal Reasoning',
      }),
    ).toBe('VR set 1')
  })
})
