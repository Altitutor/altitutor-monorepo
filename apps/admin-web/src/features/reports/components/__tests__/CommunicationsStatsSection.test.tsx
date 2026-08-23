import { render, screen } from '@testing-library/react';
import { CommunicationsStatsSection } from '../HrStatsSection';

const mockIssuesReportChart = jest.fn((_props: unknown) => <div>Form completions chart</div>);
const mockUseCommunicationsStatsReport = jest.fn((..._args: unknown[]): unknown => null);

jest.mock('@/shared/contexts/EntityModalContext', () => ({
  useEntityModals: () => ({
    openSession: jest.fn(),
    openStaff: jest.fn(),
    openStudent: jest.fn(),
    openParent: jest.fn(),
  }),
}));

jest.mock('../../hooks/useHrReports', () => ({
  useCommunicationsStatsReport: (...args: unknown[]) =>
    mockUseCommunicationsStatsReport(...args),
}));

jest.mock('../IssuesReportChart', () => ({
  IssuesReportChart: (props: unknown) => mockIssuesReportChart(props),
}));

describe('CommunicationsStatsSection', () => {
  beforeEach(() => {
    mockIssuesReportChart.mockClear();
    mockUseCommunicationsStatsReport.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        staffCheckInsByDay: [],
        studentCheckInsByDay: [],
        parentCheckInsByDay: [],
        formCompletionsByDay: [{ date: '2026-08-22', count: 3, entities: [] }],
        formCompletionTotalsByType: [
          { type: 'check_in', label: 'Check In', count: 2 },
          { type: 'feedback', label: 'Feedback', count: 1 },
        ],
      },
    });
  });

  it('renders one form-completions report with its type breakdown in the total card', () => {
    render(
      <CommunicationsStatsSection
        dateRange={{ start: new Date('2026-08-22'), end: new Date('2026-08-22') }}
        visibleCharts={{
          staffCheckIns: false,
          studentCheckIns: false,
          parentCheckIns: false,
          formCompletions: true,
        }}
      />
    );

    expect(screen.getByText('Form completions chart')).toBeInTheDocument();
    expect(mockIssuesReportChart).toHaveBeenCalledTimes(1);
    expect(mockIssuesReportChart).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Form completions',
        summaryEntriesLabel: 'By form type',
        summaryEntries: [
          { label: 'Check In', value: 2 },
          { label: 'Feedback', value: 1 },
        ],
      })
    );
  });
});
