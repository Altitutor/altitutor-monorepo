import {
  isSetTimeLimitValid,
  pacedTimeLimitSeconds,
  resolveSetTimeLimitSeconds,
} from '../set-time-limit'

describe('pacedTimeLimitSeconds', () => {
  it('uses exam pace at 1.0×', () => {
    expect(pacedTimeLimitSeconds(30, 10, 1)).toBe(300)
  })

  it('shortens time at faster than exam pace', () => {
    expect(pacedTimeLimitSeconds(30, 10, 2)).toBe(150)
  })

  it('lengthens time at slower than exam pace', () => {
    expect(pacedTimeLimitSeconds(30, 10, 0.5)).toBe(600)
  })

  it('returns null when there are no questions', () => {
    expect(pacedTimeLimitSeconds(30, 0, 1)).toBe(null)
  })
})

describe('resolveSetTimeLimitSeconds', () => {
  it('returns null for untimed sets', () => {
    expect(
      resolveSetTimeLimitSeconds({
        source: 'untimed',
        timePerQuestion: 30,
        questionCount: 10,
        speed: 1,
        customMinutes: '5',
        customSeconds: '0',
      }),
    ).toBe(null)
  })

  it('uses paced seconds from question count', () => {
    expect(
      resolveSetTimeLimitSeconds({
        source: 'paced',
        timePerQuestion: 30,
        questionCount: 10,
        speed: 1,
        customMinutes: '',
        customSeconds: '',
      }),
    ).toBe(300)
  })

  it('uses custom mm:ss', () => {
    expect(
      resolveSetTimeLimitSeconds({
        source: 'custom',
        timePerQuestion: 30,
        questionCount: 10,
        speed: 1,
        customMinutes: '4',
        customSeconds: '20',
      }),
    ).toBe(260)
  })
})

describe('isSetTimeLimitValid', () => {
  it('allows an explicit untimed set', () => {
    expect(isSetTimeLimitValid('untimed', null)).toBe(true)
  })

  it.each(['paced', 'custom'] as const)(
    'requires a positive resolved duration for %s timing',
    (source) => {
      expect(isSetTimeLimitValid(source, null)).toBe(false)
      expect(isSetTimeLimitValid(source, 0)).toBe(false)
      expect(isSetTimeLimitValid(source, 300)).toBe(true)
    },
  )
})
