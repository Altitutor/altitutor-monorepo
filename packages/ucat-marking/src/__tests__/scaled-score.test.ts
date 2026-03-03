import { scaleTo300_900 } from '../scaled-score'

describe('scaleTo300_900', () => {
  it('full score maps to 900', () => {
    expect(scaleTo300_900(10, 10)).toBe(900)
  })

  it('zero score maps to 300', () => {
    expect(scaleTo300_900(0, 10)).toBe(300)
  })

  it('half score maps to 600', () => {
    expect(scaleTo300_900(5, 10)).toBe(600)
  })

  it('rounds to nearest 10', () => {
    expect(scaleTo300_900(3, 10)).toBe(480)
    expect(scaleTo300_900(7, 10)).toBe(720)
  })

  it('handles zero max', () => {
    expect(scaleTo300_900(0, 0)).toBe(300)
  })
})
