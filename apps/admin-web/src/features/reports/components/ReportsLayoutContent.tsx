'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
} from '@altitutor/ui';
import { Calendar, ChevronDown } from 'lucide-react';
import { useReportsContext } from '../context/ReportsContext';
import {
  REPORTS_SECTION_KEYS,
  REPORTS_SECTION_LABELS,
  REPORTS_CHART_CONFIG,
} from './ReportsDateRangeCard';
import type { OperationsSubsection, SchedulingSubsection } from './ReportsDateRangeCard';

const TODAY = new Date().toISOString().slice(0, 10);

function ReportsTabs() {
  const pathname = usePathname();
  const base = '/reports';

  return (
    <nav className="flex gap-1 border-b">
      {REPORTS_SECTION_KEYS.map((key) => {
        const href = `${base}/${key}`;
        const isActive = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={key}
            href={href}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
            }`}
          >
            {REPORTS_SECTION_LABELS[key]}
          </Link>
        );
      })}
    </nav>
  );
}

function ReportsFilters() {
  const pathname = usePathname();
  const {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    visibleCharts,
    handleOperationsChartToggle,
    handleSchedulingChartToggle,
    handleFinancialChartToggle,
  } = useReportsContext();

  const OPERATIONS_SUBSECTION_LABELS: Record<OperationsSubsection, string> = {
    tasks: 'Tasks',
    issues: 'Issues',
    projects: 'Projects',
  };

  const SCHEDULING_SUBSECTION_LABELS: Record<SchedulingSubsection, string> = {
    students: 'Students',
    staff: 'Staff',
    classes: 'Classes',
  };

  const section = pathname?.includes('/scheduling')
    ? 'scheduling'
    : pathname?.includes('/financial')
      ? 'financial'
      : 'operations';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <Input
          id="reports-start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          max={TODAY}
          className="h-9 w-[140px]"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <Input
          id="reports-end-date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          max={TODAY}
          className="h-9 w-[140px]"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Calendar className="h-4 w-4 mr-2" />
            View options
            <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-h-[min(400px,80vh)] overflow-y-auto">
          {section === 'operations' &&
            (Object.keys(REPORTS_CHART_CONFIG.operations) as OperationsSubsection[]).map(
              (subsection) => (
                <div key={subsection}>
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {OPERATIONS_SUBSECTION_LABELS[subsection]}
                  </DropdownMenuLabel>
                  {(Object.keys(
                    REPORTS_CHART_CONFIG.operations[subsection]
                  ) as string[]).map((chartKey) => (
                    <DropdownMenuCheckboxItem
                      key={chartKey}
                      checked={
                        visibleCharts.operations[subsection][
                          chartKey as keyof (typeof visibleCharts.operations)[typeof subsection]
                        ]
                      }
                      onCheckedChange={(checked) =>
                        handleOperationsChartToggle(
                          subsection,
                          chartKey,
                          checked === true
                        )
                      }
                    >
                      {
                        (REPORTS_CHART_CONFIG.operations[subsection] as Record<string, string>)[
                          chartKey
                        ]
                      }
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              )
            )}
          {section === 'scheduling' &&
            (Object.keys(REPORTS_CHART_CONFIG.scheduling) as SchedulingSubsection[]).map(
                (subsection) => (
                  <div key={subsection}>
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {SCHEDULING_SUBSECTION_LABELS[subsection]}
                    </DropdownMenuLabel>
                    {(Object.keys(
                      REPORTS_CHART_CONFIG.scheduling[subsection]
                    ) as string[]).map((chartKey) => (
                      <DropdownMenuCheckboxItem
                        key={chartKey}
                        checked={
                          visibleCharts.scheduling[subsection][
                            chartKey as keyof (typeof visibleCharts.scheduling)[typeof subsection]
                          ]
                        }
                        onCheckedChange={(checked) =>
                          handleSchedulingChartToggle(
                            subsection,
                            chartKey,
                            checked === true
                          )
                        }
                      >
                        {
                          (REPORTS_CHART_CONFIG.scheduling[subsection] as Record<
                            string,
                            string
                          >)[chartKey]
                        }
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                )
              )}
          {section === 'financial' && (
            <>
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {REPORTS_SECTION_LABELS.financial}
              </DropdownMenuLabel>
              {(
                Object.keys(REPORTS_CHART_CONFIG.financial) as Array<
                  keyof typeof REPORTS_CHART_CONFIG.financial
                >
              ).map((chartKey) => (
                <DropdownMenuCheckboxItem
                  key={chartKey}
                  checked={visibleCharts.financial[chartKey]}
                  onCheckedChange={(checked) =>
                    handleFinancialChartToggle(chartKey, checked === true)
                  }
                >
                  {REPORTS_CHART_CONFIG.financial[chartKey]}
                </DropdownMenuCheckboxItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ReportsLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">View system statistics and analytics</p>
      </div>

      <div className="flex flex-col gap-4">
        <ReportsFilters />
        <ReportsTabs />
      </div>

      {children}
    </div>
  );
}
