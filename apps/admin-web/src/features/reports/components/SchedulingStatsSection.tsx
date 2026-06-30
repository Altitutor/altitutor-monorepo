'use client';

import type { ReportEntityLink } from '../types';
import type { ReportsDateRange, ReportsVisibleCharts } from './ReportsDateRangeCard';
import {
  useStudentStatsReport,
  useStaffAbsencesReport,
  useMarketingStatsReport,
} from '../hooks/useAdditionalReports';
import { IssuesReportChart } from './IssuesReportChart';
import { useEntityModals } from '@/shared/contexts/EntityModalContext';

interface SchedulingStatsSectionProps {
  dateRange: ReportsDateRange;
  visibleCharts: ReportsVisibleCharts['scheduling'];
}

export function SchedulingStatsSection({ dateRange, visibleCharts }: SchedulingStatsSectionProps) {
  const entityModals = useEntityModals();

  const { data: studentData, isLoading: studentLoading, error: studentError } =
    useStudentStatsReport(dateRange.start, dateRange.end);
  const { data: staffData, isLoading: staffLoading, error: staffError } =
    useStaffAbsencesReport(dateRange.start, dateRange.end);
  const { data: marketingData, isLoading: marketingLoading, error: marketingError } =
    useMarketingStatsReport(dateRange.start, dateRange.end);

  const isLoading = studentLoading || staffLoading || marketingLoading;
  const error = studentError || staffError || marketingError;

  const handleEntityClick = (entity: { link?: ReportEntityLink }) => {
    const link = entity.link;
    if (!link) return;
    if (
      (link.kind === 'student' ||
        link.kind === 'registration' ||
        link.kind === 'unenrolment') &&
      link.studentId
    ) {
      entityModals.openStudent(link.studentId);
    } else if (
      (link.kind === 'class' || link.kind === 'enrolment') &&
      link.classId
    ) {
      entityModals.openClass(link.classId);
    } else if (link.kind === 'staff' && link.staffId) {
      entityModals.openStaff(link.staffId);
    } else if ((link.kind === 'absence' || link.kind === 'staff') && link.sessionId) {
      entityModals.openSession(link.sessionId);
    } else if (link.studentId) {
      entityModals.openStudent(link.studentId);
    }
  };

  return (
    <>
      <div className="space-y-8">
          {error && (
            <p className="text-sm text-destructive">
              Failed to load scheduling stats. Please try again.
            </p>
          )}

          {/* Students */}
          {(visibleCharts.students.activeStudents ||
            visibleCharts.students.registrations ||
            visibleCharts.students.discontinuations ||
            visibleCharts.students.absences) && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold">Students</h3>
              <div className="space-y-6">
                {visibleCharts.students.activeStudents && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Active students</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Number of students marked ACTIVE at the end of each day.
                    </p>
                    {isLoading ? (
                      <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    ) : (
                      <IssuesReportChart
                        data={studentData?.activeStudentsByDay ?? []}
                        title="Active students"
                        entityLabelSingular="student"
                        tableVariant="activeStudents"
                        onEntityClick={handleEntityClick}
                      />
                    )}
                  </div>
                )}

                {visibleCharts.students.registrations && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Student registrations</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Number of student registrations in the period, based on
                      registered_at.
                    </p>
                    {isLoading ? (
                      <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    ) : (
                      <IssuesReportChart
                        data={marketingData?.registrationsByDay ?? []}
                        title="Student registrations"
                        entityLabelSingular="registration"
                        tableVariant="studentRegistrations"
                        onEntityClick={handleEntityClick}
                      />
                    )}
                  </div>
                )}

                {visibleCharts.students.discontinuations && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Student discontinuations</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Number of students discontinued in the period, based on
                      discontinued_at.
                    </p>
                    {isLoading ? (
                      <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    ) : (
                      <IssuesReportChart
                        data={marketingData?.discontinuationsByDay ?? []}
                        title="Student discontinuations"
                        entityLabelSingular="discontinuation"
                        tableVariant="discontinuations"
                        onEntityClick={handleEntityClick}
                      />
                    )}
                  </div>
                )}

                {visibleCharts.students.absences && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Student absences</h4>
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
                        data={studentData?.absencesByDay ?? []}
                        title="Student absences"
                        entityLabelSingular="absence"
                        tableVariant="studentAbsences"
                        onEntityClick={handleEntityClick}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Staff */}
          {visibleCharts.staff.absences && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold">Staff</h3>
              <div>
                <h4 className="text-sm font-medium mb-2">Staff absences</h4>
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
                    data={staffData?.absencesByDay ?? []}
                    title="Staff absences"
                    entityLabelSingular="absence"
                    tableVariant="staffAbsences"
                    onEntityClick={handleEntityClick}
                  />
                )}
              </div>
            </div>
          )}

          {/* Classes */}
          {(visibleCharts.classes.activeClasses ||
            visibleCharts.classes.enrolments ||
            visibleCharts.classes.unenrolments) && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold">Classes</h3>
              <div className="space-y-6">
                {visibleCharts.classes.activeClasses && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Active classes</h4>
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
                        data={studentData?.activeClassesByDay ?? []}
                        title="Active classes"
                        entityLabelSingular="class"
                        tableVariant="activeClasses"
                        onEntityClick={handleEntityClick}
                      />
                    )}
                  </div>
                )}

                {visibleCharts.classes.enrolments && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Class enrolments</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Number of class enrolments created within the day.
                    </p>
                    {isLoading ? (
                      <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    ) : (
                      <IssuesReportChart
                        data={studentData?.enrolmentsByDay ?? []}
                        title="Class enrolments"
                        entityLabelSingular="enrolment"
                        tableVariant="classEnrolments"
                        onEntityClick={handleEntityClick}
                      />
                    )}
                  </div>
                )}

                {visibleCharts.classes.unenrolments && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Class unenrolments</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Number of class unenrolments recorded within the day.
                    </p>
                    {isLoading ? (
                      <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    ) : (
                      <IssuesReportChart
                        data={studentData?.unenrolmentsByDay ?? []}
                        title="Class unenrolments"
                        entityLabelSingular="unenrolment"
                        tableVariant="classUnenrolments"
                        onEntityClick={handleEntityClick}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </>
  );
}
