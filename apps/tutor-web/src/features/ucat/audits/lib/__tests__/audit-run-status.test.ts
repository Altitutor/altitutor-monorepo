import { auditRunStatusChangeCopy } from '../audit-run-status'

describe('audit run status confirmation copy', () => {
  it('asks to confirm a change and names the current status', () => {
    expect(auditRunStatusChangeCopy('active', 'completed')).toEqual({
      title: 'Change this audit to Completed?',
      description:
        'This audit is currently active. The board becomes read-only. Every target must already be finished.',
    })
  })

  it('does not describe a no-op as a change', () => {
    expect(auditRunStatusChangeCopy('cancelled', 'cancelled').title).toBe(
      'Keep this audit cancelled?',
    )
  })
})


describe('audit run status confirmation copy', () => {
  it('asks to confirm a change and names the current status', () => {
    expect(auditRunStatusChangeCopy('active', 'completed')).toEqual({
      title: 'Change this audit to Completed?',
      description:
        'This audit is currently active. The board becomes read-only. Every target must already be finished.',
    })
  })

  it('does not describe a no-op as a change', () => {
    expect(auditRunStatusChangeCopy('cancelled', 'cancelled').title).toBe(
      'Keep this audit cancelled?',
    )
  })
})
