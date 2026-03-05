'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import type { ReportDataPoint, ReportEntityLink } from '../types';
import { ViewStaffModal } from '@/features/staff';
import { SessionModal } from '@/features/sessions';
import { useStaffAbsencesReport } from '../hooks/useAdditionalReports';
import { IssuesReportChart } from './IssuesReportChart';

export function StaffStatsSection() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<ReportDataPoint | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });
  const weekEnd = endOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });

  const { data, isLoading, error } = useStaffAbsencesReport(weekStart, weekEnd);

  const weekLabel = `${format(weekStart, 'd MMM')} – ${format(
    weekEnd,
    'd MMM yyyy'
  )}`;

  const handleBarClick = (point: ReportDataPoint) => {
    if (!point.entities.length) {
      setSelectedPoint(null);
      return;
    }
    setSelectedPoint(point);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff stats
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekOffset((o) => o - 1)}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekOffset((o) => o + 1)}
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <p className="text-sm text-destructive">
              Failed to load staff stats. Please try again.
            </p>
          )}

          <p className="text-xs text-muted-foreground">Week: {weekLabel}</p>

          <div>
            <h3 className="text-sm font-medium mb-2">Staff absences</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Number of staff absences logged on each day. Drill down to see
              whether the session was swapped and who swapped in.
            </p>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <IssuesReportChart
                data={data?.absencesByDay ?? []}
                title="Staff absences"
                barColor="hsl(12, 76%, 40%)"
                onBarClick={handleBarClick}
                entityLabelSingular="absence"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedPoint}
        onOpenChange={(open) => {
          if (!open) setSelectedPoint(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedPoint
                ? `Staff absences on ${selectedPoint.date} (${selectedPoint.count})`
                : 'Staff absences'}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
            {selectedPoint?.entities.length ? (
              selectedPoint.entities.map((entity) => {
                const link = entity.link as ReportEntityLink | undefined;
                const handleClick = () => {
                  if (!link) return;
                  if (link.kind === 'staff' && link.staffId) {
                    setSelectedStaffId(link.staffId);
                  } else if (link.sessionId) {
                    setSelectedSessionId(link.sessionId);
                  }
                };

                const isClickable = !!entity.link;

                return (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={handleClick}
                    disabled={!isClickable}
                    className={`block w-full text-left text-sm ${
                      isClickable
                        ? 'text-brand-darkBlue hover:underline dark:text-brand-lightBlue'
                        : 'text-muted-foreground cursor-default'
                    }`}
                  >
                    {entity.name}
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                No staff absences for this day.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ViewStaffModal
        isOpen={!!selectedStaffId}
        staffId={selectedStaffId}
        onClose={() => setSelectedStaffId(null)}
        onStaffUpdated={() => {}}
      />

      <SessionModal
        isOpen={!!selectedSessionId}
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
    </>
  );
}

