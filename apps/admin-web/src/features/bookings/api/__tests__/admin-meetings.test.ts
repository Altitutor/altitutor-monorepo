import { manualMeetingSchema } from '../admin-meetings';

it('accepts flexible participant mixes without availability or type-specific cardinality rules', () => {
  const result = manualMeetingSchema.safeParse({
    type: 'ADMIN_MEETING', startAt: '2026-10-29T00:00:00Z', endAt: '2026-10-29T01:00:00Z',
    studentIds: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'],
    parentIds: ['00000000-0000-4000-8000-000000000003'], staffIds: [], receiverStaffIds: [],
  });
  expect(result.success).toBe(true);
});

it('accepts minute-precision meeting times without rewriting them', () => {
  const meeting = {
    type: 'ADMIN_MEETING',
    startAt: '2026-11-01T10:30Z',
    endAt: '2026-11-01T11:30Z',
  };

  expect(manualMeetingSchema.parse(meeting)).toEqual({
    ...meeting,
    studentIds: [],
    parentIds: [],
    staffIds: [],
    receiverStaffIds: [],
  });
});
