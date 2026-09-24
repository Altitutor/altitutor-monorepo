import type { ReportDataPoint } from '../../types';
import { buildReportSummary } from '../reportSummaries';

const data: ReportDataPoint[] = [
  {
    date: '2026-08-21',
    count: 2,
    entities: [
      { id: 'a', name: 'A', meta: { assignee: 'Alex' } },
      { id: 'b', name: 'B', meta: { assignee: 'Blair' } },
    ],
  },
  {
    date: '2026-08-22',
    count: 3,
    entities: [
      { id: 'a', name: 'A', meta: { assignee: 'Alex' } },
      { id: 'c', name: 'C', meta: { assignee: 'Alex' } },
      { id: 'd', name: 'D' },
    ],
  },
];

describe('buildReportSummary', () => {
  it('uses the final snapshot and hides staff without attributed entities', () => {
    expect(buildReportSummary(data, 'latest', ['assignee'])).toEqual({
      total: 3,
      byStaff: [{ label: 'Alex', value: 2 }],
    });
  });

  it('sums event totals while de-duplicating staff attribution', () => {
    expect(buildReportSummary(data, 'sum', ['assignee'])).toEqual({
      total: 5,
      byStaff: [
        { label: 'Alex', value: 2 },
        { label: 'Blair', value: 1 },
      ],
    });
  });

  it('uses an explicit summary identity for repeated drill-down rows', () => {
    const repeatedRows: ReportDataPoint[] = [
      {
        date: '2026-08-22',
        count: 1,
        entities: [
          { id: 'class-a', name: 'Class A', meta: { createdBy: 'Alex', summaryKey: 'subsidy-1' } },
          { id: 'class-b', name: 'Class B', meta: { createdBy: 'Alex', summaryKey: 'subsidy-1' } },
        ],
      },
    ];

    expect(buildReportSummary(repeatedRows, 'latest', ['createdBy']).byStaff).toEqual([
      { label: 'Alex', value: 1 },
    ]);
  });

  it('attributes one session to every staff member present without double-counting names', () => {
    const sessions: ReportDataPoint[] = [
      {
        date: '2026-08-22',
        count: 2,
        entities: [
          { id: 'session-a', name: 'A', meta: { staffNames: ['Alex', 'Blair', 'Alex'] } },
          { id: 'session-b', name: 'B', meta: { staffNames: ['Blair'] } },
        ],
      },
    ];

    expect(buildReportSummary(sessions, 'sum', ['staffNames'])).toEqual({
      total: 2,
      byStaff: [
        { label: 'Blair', value: 2 },
        { label: 'Alex', value: 1 },
      ],
    });
  });
});
