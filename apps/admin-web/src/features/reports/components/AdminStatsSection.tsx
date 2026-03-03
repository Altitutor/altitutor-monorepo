'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from '@altitutor/ui';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIssuesReport } from '../hooks/useIssuesReport';
import { IssuesReportChart } from './IssuesReportChart';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
} from 'date-fns';
import type { ReportDataPoint } from '../types';
import { EditIssueDialog } from '@/features/issues/components/EditIssueDialog';

export function AdminStatsSection() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<ReportDataPoint | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });
  const weekEnd = endOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });

  const { data, isLoading, error } = useIssuesReport(weekStart, weekEnd);

  const weekLabel = `${format(weekStart, 'd MMM')} – ${format(weekEnd, 'd MMM yyyy')}`;

  const handleBarClick = (point: ReportDataPoint) => {
    if (!point.entities.length) {
      setSelectedPoint(null);
      return;
    }
    setSelectedPoint(point);
  };

  const handleIssueClick = (issueId: string) => {
    setSelectedIssueId(issueId);
    setIsIssueDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Admin Stats
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
        <CardContent className="space-y-8">
          {error && (
            <p className="text-sm text-destructive">
              Failed to load report data. Please try again.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Week: {weekLabel}
          </p>

          <div>
            <h3 className="text-sm font-medium mb-2">Open issues at end of day</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Number of issues that were open (not resolved) at the end of each day
            </p>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <IssuesReportChart
                data={data?.openByDay ?? []}
                title="Open issues"
                barColor="#0a2941"
                onBarClick={handleBarClick}
              />
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Resolved issues within period</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Number of issues resolved on each day
            </p>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <IssuesReportChart
                data={data?.resolvedByDay ?? []}
                title="Resolved issues"
                barColor="hsl(142, 76%, 36%)"
                onBarClick={handleBarClick}
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
                ? `Issues on ${selectedPoint.date} (${selectedPoint.count})`
                : 'Issues'}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
            {selectedPoint?.entities.length ? (
              selectedPoint.entities.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => handleIssueClick(entity.id)}
                  className="w-full text-left text-sm text-brand-darkBlue hover:underline dark:text-brand-lightBlue truncate"
                  title={entity.name}
                >
                  {entity.name}
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No issues for this day.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EditIssueDialog
        isOpen={isIssueDialogOpen}
        onClose={() => {
          setIsIssueDialogOpen(false);
          setSelectedIssueId(null);
        }}
        issueId={selectedIssueId}
        onIssueUpdated={() => {}}
      />
    </>
  );
}
