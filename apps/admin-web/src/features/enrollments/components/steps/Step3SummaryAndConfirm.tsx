'use client';

import { ScrollArea } from '@altitutor/ui';
import { Alert, AlertDescription } from '@altitutor/ui';
import { AlertTriangle } from 'lucide-react';
import { format, differenceInMinutes, isSameDay } from 'date-fns';
import { StudentCard } from '@/shared/components/StudentCard';
import { ClassCard } from '@/shared/components/ClassCard';
import { calculateFirstSessionDate } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import { cn } from '@/shared/utils';
import { SessionsCard } from '@/features/sessions/components/SessionsCard';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { EnrollmentContext, EnrollmentConflicts, StudentWithEnrollmentInfo } from '../../types/enrollment';

interface Step3SummaryAndConfirmProps {
  context: EnrollmentContext;
  selectedStudent?: StudentWithEnrollmentInfo | Tables<'students'>;
  selectedClass?: ClassWithExpandedSubject;
  studentSubjects?: Tables<'subjects'>[];
  enrollmentDate: string;
  conflicts: EnrollmentConflicts;
}

export function Step3SummaryAndConfirm({
  context,
  selectedStudent,
  selectedClass,
  studentSubjects,
  enrollmentDate,
  conflicts,
}: Step3SummaryAndConfirmProps) {
  // Calculate first session date
  const firstSessionDate = selectedClass && enrollmentDate && selectedClass.day_of_week !== undefined && selectedClass.start_time
    ? calculateFirstSessionDate(
        { day_of_week: selectedClass.day_of_week, start_time: selectedClass.start_time },
        getMidnightAdelaide(new Date(enrollmentDate))
      )
    : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 pr-4">
          <div className="space-y-3">
            {selectedStudent && (
              <div>
                <StudentCard
                  student={selectedStudent as Tables<'students'>}
                  subjects={('subjects' in selectedStudent ? (selectedStudent as any).subjects : studentSubjects) || []}
                />
              </div>
            )}

            {selectedClass && (
              <div>
                <ClassCard
                  class={selectedClass}
                  subject={selectedClass.subject}
                  staff={selectedClass.staff || []}
                  students={selectedClass.students || []}
                />
              </div>
            )}

            {firstSessionDate && selectedClass && selectedClass.start_time && selectedClass.end_time && (
              <div className="border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
                <ScrollArea className="flex-1 min-h-0">
                  <div className="overflow-x-auto">
                    {(() => {
                      const startDate = new Date(firstSessionDate);
                      const [startHours, startMinutes] = selectedClass.start_time.split(':').map(Number);
                      const [endHours, endMinutes] = selectedClass.end_time.split(':').map(Number);
                      const endDate = new Date(startDate);
                      endDate.setHours(endHours, endMinutes, 0, 0);
                      
                      const session: Tables<'sessions'> = {
                        id: 'preview-session',
                        start_at: startDate.toISOString(),
                        end_at: endDate.toISOString(),
                        type: 'CLASS',
                        class_id: selectedClass.id,
                        subject_id: selectedClass.subject_id,
                        created_at: null,
                        updated_at: null,
                        status: 'ACTIVE',
                        billing_type: null,
                      };
                      
                      // Time grid: 9am to 8pm
                      const slots = Array.from({ length: 12 }, (_, i) => 9 + i);
                      const slotHeight = 75; // px per hour
                      const minutesFromStart = (date: Date) => (date.getHours() * 60 + date.getMinutes()) - (9 * 60);
                      
                      // Calculate position for the session
                      const sStart = new Date(session.start_at!);
                      const sEnd = new Date(session.end_at!);
                      const top = Math.max(0, (minutesFromStart(sStart) / 60) * slotHeight);
                      const height = Math.max(30, (differenceInMinutes(sEnd, sStart) / 60) * slotHeight);
                      const cardHeight = Math.max(height, 45);
                      const cardWidth = 180; // Estimated width for single day
                      
                      const now = new Date();
                      const isToday = isSameDay(firstSessionDate, now);
                      
                      return (
                        <div className="relative min-w-max" style={{ minHeight: `${slots.length * slotHeight}px` }}>
                          <div
                            className="grid gap-0 relative bg-background"
                            style={{ gridTemplateColumns: `minmax(80px, 100px) minmax(200px, 1fr)` }}
                          >
                            {/* Headers */}
                            <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-xs">Time</div>
                            <div className={cn(
                              "sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-sm",
                              isToday && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            )}>
                              {format(firstSessionDate, 'EEE dd MMM')}
                            </div>
                            
                            {/* Rows */}
                            {slots.map((hour, idx) => (
                              <div key={hour} className="contents">
                                <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[75px] flex items-center justify-center">
                                  {format(new Date(2000, 0, 1, hour, 0), 'h a')}
                                </div>
                                <div key={`${firstSessionDate.toISOString()}-${hour}`} className={cn(
                                  "relative border-b border-r h-[75px]",
                                  isToday ? "bg-blue-50/30 dark:bg-blue-900/10" : "bg-background"
                                )}>
                                  {idx === 0 && (
                                    <div className="absolute inset-0" style={{ height: `${slots.length * slotHeight}px` }}>
                                      {/* Today indicator line */}
                                      {isToday && (() => {
                                        const todayDayIndex = 0;
                                        const currentMinutesFromStart = minutesFromStart(now);
                                        const showTodayIndicator = todayDayIndex >= 0 && currentMinutesFromStart >= 0 && currentMinutesFromStart < (slots.length * 75);
                                        return showTodayIndicator && (
                                          <div 
                                            className="absolute left-0 right-0 z-30 pointer-events-none"
                                            style={{ top: `${(currentMinutesFromStart / 60) * slotHeight}px` }}
                                          >
                                            <div className="flex items-center">
                                              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                                              <div className="flex-1 h-0.5 bg-red-500" />
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      
                                      {/* Session Card */}
                                      <div
                                        className="absolute"
                                        style={{ 
                                          top: `${top}px`, 
                                          height: `${cardHeight}px`, 
                                          left: '2.5%', 
                                          width: '95%', 
                                          zIndex: 20, 
                                          minHeight: '45px' 
                                        }}
                                      >
                                        <SessionsCard
                                          session={session}
                                          classData={selectedClass}
                                          subject={selectedClass.subject || undefined}
                                          staff={selectedClass.staff || []}
                                          students={selectedClass.students || []}
                                          onClick={() => {}}
                                          isCalendarView={true}
                                          cardHeight={cardHeight}
                                          cardWidth={cardWidth}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Warnings */}
          {(conflicts.sameSubjectWarning || conflicts.timeOverlapWarnings.length > 0) && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {conflicts.sameSubjectWarning && (
                  <p className="font-medium">{conflicts.sameSubjectWarning}</p>
                )}
                {conflicts.timeOverlapWarnings.map((warning, i) => (
                  <p key={i} className="text-sm">{warning}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

