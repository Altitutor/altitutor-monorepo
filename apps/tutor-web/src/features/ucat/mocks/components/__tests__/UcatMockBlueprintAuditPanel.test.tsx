import React from 'react'
import { render, screen } from '@testing-library/react'
import { UcatMockBlueprintAuditPanel } from '@/features/ucat/mocks/components/UcatMockBlueprintAuditPanel'
import type { UcatMockBlueprintCandidateController } from '@/features/ucat/mocks/hooks/useUcatMockBlueprintCandidate'

jest.mock('@altitutor/ui', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  SearchableSelect: () => <div aria-label="Blueprint selector" />,
}))

const storedCompliance = {
  applicable: true,
  compliant: false,
  sections: [{
    section: 'decision_making' as const,
    compliant: false,
    checks: [{
      code: 'CATEGORY_COUNT_OUT_OF_RANGE',
      label: 'Syllogisms',
      unit: 'questions',
      actual: 3,
      compliant: false,
      minimum: 5,
      maximum: 7,
      reason: 'Allowed 5–7; found 3.',
    }],
  }],
}

describe('UcatMockBlueprintAuditPanel', () => {
  it('keeps failed reasons from the durable audit snapshot visible', () => {
    const controller: UcatMockBlueprintCandidateController = {
      attachedBlueprintId: null,
      candidateBlueprintId: 'blueprint-1',
      setCandidateBlueprintId: jest.fn(),
      compliance: null,
      latestAudit: {
        id: 'audit-1',
        mockId: 'mock-1',
        blueprintId: 'blueprint-1',
        blueprintCode: 'ucat-anz-2026-v1',
        testYear: 2026,
        version: 1,
        checkedAt: '2026-08-10T12:00:00.000Z',
        decision: 'failed',
        gateResults: {
          compliance: storedCompliance,
          publicationState: { compliant: true, reason: 'Every shared set and stem is published.' },
          sectionPurity: { compliant: true, reason: 'Every shared set contains exactly one section.' },
          provisionalMetadata: { reviewed: true, reason: 'Required metadata has been reviewed.' },
        },
      },
      auditPending: false,
      confirmPending: false,
      auditCandidate: jest.fn(async () => undefined),
      confirmCandidate: jest.fn(async () => undefined),
    }

    render(<UcatMockBlueprintAuditPanel
      blueprints={[{ id: 'blueprint-1', code: 'ucat-anz-2026-v1', test_year: 2026, version: 1 }]}
      controller={controller}
    />)

    expect(screen.getByText('Stored audit snapshot')).toBeInTheDocument()
    expect(screen.getByText('Allowed 5–7; found 3.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm and attach' })).toBeDisabled()
  })
})
