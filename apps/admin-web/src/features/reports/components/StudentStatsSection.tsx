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
import { GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import type { ReportDataPoint, ReportEntityLink } from '../types';
import { ViewStudentModal } from '@/features/students';
import { ViewClassModal } from '@/features/classes';
import { SessionModal } from '@/features/sessions';
import { useStudentStatsReport } from '../hooks/useAdditionalReports';
import { IssuesReportChart } from './IssuesReportChart';

type DialogKind =
  | 'activeStudents'
  | 'activeClasses'
  | 'enrolments'
  | 'unenrolments'
  | 'absences'
  | null;

export function StudentStatsSection() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [selectedPoint, setSelectedPoint] = useState<ReportDataPoint | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });
  const weekEnd = endOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });

  const { data, isLoading, error } = useStudentStatsReport(weekStart, weekEnd);

  const weekLabel = `${format(weekStart, 'd MMM')} – ${format(
    weekEnd,
    'd MMM yyyy'
  )}`;

  const openDialog =
    (kind: Exclude<DialogKind, null>) =>
    (point: ReportDataPoint) => {
      if (!point.entities.length) {
        setSelectedPoint(null);
        setDialogKind(null);
        return;
      }
      setSelectedPoint(point);
      setDialogKind(kind);
    };

  const closeDialog = () => {
    setDialogKind(null);
    setSelectedPoint(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Student stats
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
              Failed to load student stats. Please try again.
            </p>
          )}

          <p className="text-xs text-muted-foreground">Week: {weekLabel}</p>

          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-medium mb-2">Active students</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Number of students marked ACTIVE at the end of each day.
              </p>
              {isLoading ? (
                <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <IssuesReportChart
                  data={data?.activeStudentsByDay ?? []}
                  title="Active students"
                  barColor="#0a2941"
                  onBarClick={openDialog('activeStudents')}
                  entityLabelSingular="student"
                />
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Active classes</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Classes with current date between session_start_date and
                session_end_date.
              </p>
              {isLoading ? (
                <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <IssuesReportChart
                  data={data?.activeClassesByDay ?? []}
                  title="Active classes"
                  barColor="#2563eb"
                  onBarClick={openDialog('activeClasses')}
                  entityLabelSingular="class"
                />
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-medium mb-2">Class enrolments</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Number of class enrolments created within the day.
              </p>
              {isLoading ? (
                <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <IssuesReportChart
                  data={data?.enrolmentsByDay ?? []}
                  title="Class enrolments"
                  barColor="#16a34a"
                  onBarClick={openDialog('enrolments')}
                  entityLabelSingular="enrolment"
                />
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Class unenrolments</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Number of class unenrolments recorded within the day.
              </p>
              {isLoading ? (
                <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <IssuesReportChart
                  data={data?.unenrolmentsByDay ?? []}
                  title="Class unenrolments"
                  barColor="#f97316"
                  onBarClick={openDialog('unenrolments')}
                  entityLabelSingular="unenrolment"
                />
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Student absences</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Number of absences logged per day, including whether each absence
              was credited or rescheduled.
            </p>
            {isLoading ? (
              <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <IssuesReportChart
                data={data?.absencesByDay ?? []}
                title="Student absences"
                barColor="#b45309"
                onBarClick={openDialog('absences')}
                entityLabelSingular="absence"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogKind !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {(() => {
                if (!selectedPoint) return 'Student stats';
                const base = `${selectedPoint.date}`;
                switch (dialogKind) {
                  case 'activeStudents':
                    return `Active students on ${base} (${selectedPoint.count})`;
                  case 'activeClasses':
                    return `Active classes on ${base} (${selectedPoint.count})`;
                  case 'enrolments':
                    return `Class enrolments on ${base} (${selectedPoint.count})`;
                  case 'unenrolments':
                    return `Class unenrolments on ${base} (${selectedPoint.count})`;
                  case 'absences':
                    return `Student absences on ${base} (${selectedPoint.count})`;
                  default:
                    return 'Student stats';
                }
              })()}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
            {selectedPoint?.entities.length ? (
              selectedPoint.entities.map((entity) => {
                const link = entity.link as ReportEntityLink | undefined;
                const handleClick = () => {
                  if (!link) return;
                  if (
                    (link.kind === 'student' || link.kind === 'registration') &&
                    link.studentId
                  ) {
                    setSelectedStudentId(link.studentId);
                  } else if (
                    (link.kind === 'class' ||
                      link.kind === 'enrolment' ||
                      link.kind === 'unenrolment') &&
                    link.classId
                  ) {
                    setSelectedClassId(link.classId);
                  } else if (link.kind === 'absence' && link.sessionId) {
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
                No records for this day.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ViewStudentModal
        isOpen={!!selectedStudentId}
        onClose={() => setSelectedStudentId(null)}
        studentId={selectedStudentId}
        onStudentUpdated={() => {}}
      />

      <ViewClassModal
        isOpen={!!selectedClassId}
        onClose={() => setSelectedClassId(null)}
        classId={selectedClassId}
        onClassUpdated={() => {}}
      />

      <SessionModal
        isOpen={!!selectedSessionId}
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
    </>
  );
}

