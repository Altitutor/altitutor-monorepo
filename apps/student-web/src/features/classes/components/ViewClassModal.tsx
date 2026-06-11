'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@altitutor/ui';
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';
import { Loader2, Calendar, Clock, MapPin, User } from 'lucide-react';
import { useClassDetails, useClassSessions } from '../hooks';
import { formatTime, getDayShortName } from '@/shared/utils/datetime';
import { formatDateTime } from '@/shared/utils';
import { getSubjectCurriculumColor } from '@/shared/utils';
import { cn } from '@/shared/utils';
import type { Database } from '@altitutor/shared';

type StudentClassDetail = Database['public']['Views']['vstudent_class_detail']['Row'];
type ClassStudent = { first_name: string; last_name: string; year_level?: number };
type ClassStaff = { first_name: string; last_name: string; subjects?: string[] };
type ClassSession = Database['public']['Views']['vstudent_sessions']['Row'];

interface ViewClassModalProps {
  classId: string | null;
  onClose: () => void;
}

export function ViewClassModal({ classId, onClose }: ViewClassModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'sessions'>('details');
  const { data: classDetails, isLoading: isLoadingDetails } = useClassDetails(classId);
  const { data: sessions, isLoading: isLoadingSessions } = useClassSessions(classId);

  const isOpen = classId !== null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {isLoadingDetails ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : classDetails ? (
          <>
            <SheetHeader>
              <SheetTitle>Class Details</SheetTitle>
            </SheetHeader>

            <SegmentedTabPanel
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as 'details' | 'sessions')}
              className="mt-6"
              options={[
                { value: 'details', label: 'Class Details' },
                { value: 'sessions', label: 'Sessions' },
              ]}
            >
              <SegmentedTabPanelContent when="details" activeTab={activeTab} className="mt-4 space-y-4">
                {/* Subject Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Subject</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          getSubjectCurriculumColor(classDetails.subject_curriculum)
                        )}
                      >
                        {classDetails.subject_curriculum}
                      </Badge>
                      <span className="font-semibold">{classDetails.subject_name}</span>
                    </div>
                    {classDetails.subject_level && (
                      <p className="text-sm text-muted-foreground">
                        Level: {classDetails.subject_level}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Schedule Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Schedule</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {classDetails.day_of_week !== null ? getDayShortName(classDetails.day_of_week) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {classDetails.start_time && classDetails.end_time
                          ? `${formatTime(classDetails.start_time)} - ${formatTime(classDetails.end_time)}`
                          : '-'
                        }
                      </span>
                    </div>
                    {classDetails.room && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>Room {classDetails.room}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Students in Class */}
                {classDetails.students && 
                 Array.isArray(classDetails.students) && 
                 classDetails.students.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Students</CardTitle>
                      <CardDescription>
                        {classDetails.students.length} student{classDetails.students.length !== 1 ? 's' : ''} in this class
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {((classDetails as StudentClassDetail & { students?: ClassStudent[] }).students || []).map((student, index) => (
                          <div 
                            key={index} 
                            className="flex items-center gap-2 py-2 border-b last:border-0"
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {student.first_name} {student.last_name}
                              </p>
                              {student.year_level && (
                                <p className="text-xs text-muted-foreground">
                                  Year {student.year_level}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Staff Teaching */}
                {classDetails.staff && 
                 Array.isArray(classDetails.staff) && 
                 classDetails.staff.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Teachers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {((classDetails as StudentClassDetail & { staff?: ClassStaff[] }).staff || []).map((staffMember, index) => (
                          <div 
                            key={index} 
                            className="flex items-center gap-2 py-2 border-b last:border-0"
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {staffMember.first_name} {staffMember.last_name}
                              </p>
                              {staffMember.subjects && Array.isArray(staffMember.subjects) && staffMember.subjects.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Teaches: {staffMember.subjects.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </SegmentedTabPanelContent>

              <SegmentedTabPanelContent when="sessions" activeTab={activeTab} className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Class Sessions</CardTitle>
                    <CardDescription>
                      {sessions?.length || 0} session{sessions?.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingSessions ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : sessions && sessions.length > 0 ? (
                      <div className="space-y-3">
                        {(sessions as ClassSession[]).map((session) => (
                          <div 
                            key={session.session_id} 
                            className="p-3 border rounded-lg space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">
                                {session.start_at ? formatDateTime(session.start_at) : '-'}
                              </p>
                              {(session as ClassSession & { attendance_status?: string | null }).attendance_status && (
                                <Badge variant={(session as ClassSession & { attendance_status?: string | null }).attendance_status === 'PRESENT' ? 'default' : 'secondary'}>
                                  {(session as ClassSession & { attendance_status?: string | null }).attendance_status}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              {session.planned_absence && (
                                <Badge variant="outline" className="text-xs">Planned Absence</Badge>
                              )}
                              {session.is_credited && (
                                <Badge variant="outline" className="text-xs">Credited</Badge>
                              )}
                              {session.is_rescheduled && (
                                <Badge variant="outline" className="text-xs">Rescheduled</Badge>
                              )}
                            </div>
                            
                            {(session as ClassSession & { has_tutor_log?: boolean | null }).has_tutor_log && (
                              <p className="text-xs text-muted-foreground">
                                ✓ Has tutor log
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No sessions scheduled yet
                      </p>
                    )}
                  </CardContent>
                </Card>
              </SegmentedTabPanelContent>
            </SegmentedTabPanel>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Class not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

