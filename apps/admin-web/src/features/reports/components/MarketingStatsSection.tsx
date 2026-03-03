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
import { Megaphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import type { ReportDataPoint } from '../types';
import { useMarketingStatsReport } from '../hooks/useAdditionalReports';
import { IssuesReportChart } from './IssuesReportChart';

export function MarketingStatsSection() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<ReportDataPoint | null>(null);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });
  const weekEnd = endOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });

  const { data, isLoading, error } = useMarketingStatsReport(weekStart, weekEnd);

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
              <Megaphone className="h-5 w-5" />
              Marketing stats
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
              Failed to load marketing stats. Please try again.
            </p>
          )}

          <p className="text-xs text-muted-foreground">Week: {weekLabel}</p>

          <div>
            <h3 className="text-sm font-medium mb-2">Student registrations</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Number of student registrations in the period, based on
              registered_at.
            </p>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <IssuesReportChart
                data={data?.registrationsByDay ?? []}
                title="Student registrations"
                barColor="#7c3aed"
                onBarClick={handleBarClick}
                entityLabelSingular="registration"
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
                ? `Student registrations on ${selectedPoint.date} (${selectedPoint.count})`
                : 'Student registrations'}
          </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
            {selectedPoint?.entities.length ? (
              selectedPoint.entities.map((entity) => (
                <p
                  key={entity.id}
                  className="text-sm text-brand-darkBlue dark:text-brand-lightBlue"
                >
                  {entity.name}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No registrations for this day.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

