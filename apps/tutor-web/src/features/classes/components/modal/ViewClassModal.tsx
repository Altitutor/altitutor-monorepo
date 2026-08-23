'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SessionInfoGrid,
  Badge,
  ClassStatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';
import { cn } from '@/shared/utils';
import {
  tutorModalHairline,
  tutorSheetContentClass,
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorTableShell,
} from '@/shared/lib/tutor-visual';
import { useClassModalData } from '../../hooks/useClassModalData';

interface ViewClassModalProps {
  isOpen: boolean;
  classId: string | null;
  onClose: () => void;
  onClassUpdated?: () => void;
}

export function ViewClassModal({
  isOpen,
  classId,
  onClose,
  onClassUpdated: _onClassUpdated,
}: ViewClassModalProps) {
  const { students, staff, classData, subject, isLoading } = useClassModalData({
    isOpen,
    classId,
  });

  if (isLoading || !classData) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          className={cn(
            'flex h-full max-h-[100dvh] w-full flex-col p-0 md:w-[600px] md:max-w-none',
            tutorSheetContentClass,
          )}
        >
          <div className="flex-1 overflow-y-auto p-6">
            <SheetHeader className="mb-6">
              <SheetTitle>{isLoading ? 'Loading...' : 'Class Details'}</SheetTitle>
            </SheetHeader>
            {isLoading ? (
              <div className="py-6 text-center text-muted-foreground">Loading class details...</div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Class not found or you do not have access to it.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const classTitle =
    classData.long_name?.trim() ||
    classData.short_name?.trim() ||
    classData.level?.trim() ||
    'Class Details';

  const sortedStudents = [...students].sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
  );

  const sortedStaff = [...staff].sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className={cn(
          'flex h-full max-h-[100dvh] w-full flex-col p-0 md:w-[600px] md:max-w-none',
          tutorSheetContentClass,
        )}
      >
        <div className="flex-1 overflow-y-auto p-6">
          <SheetHeader className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SheetTitle>Class Details</SheetTitle>
                <SheetDescription className="text-lg font-medium">{classTitle}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-lg font-semibold">Class Information</h3>
              <SessionInfoGrid
                day={classData.schedule_weekdays.length > 0 ? classData.schedule_weekdays.map(getDayOfWeek).join(', ') : getDayOfWeek(classData.day_of_week)}
                time={classData.schedule_summary_long || `${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`}
                subjectNode={
                  subject
                    ? (() => {
                        const { style, textColorClass } = getSubjectColorStyle(subject);
                        const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                        return (
                          <Badge
                            className={defaultClass || textColorClass}
                            style={style.backgroundColor ? style : undefined}
                          >
                            {formatSubjectDisplay(subject)}
                          </Badge>
                        );
                      })()
                    : '—'
                }
              />
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="text-sm font-medium text-muted-foreground">Status:</div>
                <div className="text-sm">
                  <ClassStatusBadge
                    value={classData.status === 'ACTIVE' || classData.status === 'INACTIVE' ? classData.status : null}
                  />
                </div>
                <div className="text-sm font-medium text-muted-foreground">Room:</div>
                <div className="text-sm">{classData.room || '—'}</div>
              </div>
            </div>

            <div className={cn(tutorModalHairline, 'my-2')} role="presentation" />

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Students ({sortedStudents.length})</h3>
              </div>
              {sortedStudents.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No students enrolled
                </div>
              ) : (
                <div className={tutorTableShell}>
                  <Table>
                    <TableHeader className="[&_tr]:border-b-0">
                      <TableRow className={tutorTableHeaderRow}>
                        <TableHead>Student</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedStudents.map((student) => (
                        <TableRow key={student.id} className={tutorTableBodyRow}>
                          <TableCell className="font-medium">
                            {student.first_name} {student.last_name}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className={cn(tutorModalHairline, 'my-2')} role="presentation" />

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Staff ({sortedStaff.length})</h3>
              </div>
              {sortedStaff.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">No staff assigned</div>
              ) : (
                <div className={tutorTableShell}>
                  <Table>
                    <TableHeader className="[&_tr]:border-b-0">
                      <TableRow className={tutorTableHeaderRow}>
                        <TableHead>Staff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedStaff.map((staffMember) => (
                        <TableRow key={staffMember.id} className={tutorTableBodyRow}>
                          <TableCell className="font-medium">
                            {staffMember.first_name} {staffMember.last_name}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
