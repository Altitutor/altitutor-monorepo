'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from '@altitutor/ui';
import { Badge, SkeletonTable } from '@altitutor/ui';
import { Eye } from 'lucide-react';
import { useClasses } from '../hooks/useClassesQuery';
import { ViewClassModal } from './modal/ViewClassModal';
import { cn } from '@/shared/utils';
import { getSubjectColorStyle } from '@/shared/utils';
import { formatTime, getDayShortName } from '@/shared/utils/datetime';
import type { Database, Tables } from '@altitutor/shared';
import { tutorBtnOutline, tutorTableBodyRow, tutorTableHeaderRow, tutorTableShell } from '@/shared/lib/tutor-visual';

type TutorClassRow = Database['public']['Views']['vtutor_classes']['Row'];

export function TutorClassesTable() {
  const { data: classes, isLoading, error } = useClasses();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  const handleViewClass = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className={tutorTableShell}>
          <SkeletonTable rows={6} columns={4} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-destructive">
        Error loading classes: {error.message}
      </div>
    );
  }

  if (!classes || classes.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        You are not assigned to any classes yet.
      </div>
    );
  }

  const sortedClasses = [...classes].sort((a: TutorClassRow, b: TutorClassRow) => {
    const dayA = a.day_of_week ?? 999;
    const dayB = b.day_of_week ?? 999;
    if (dayA !== dayB) return dayA - dayB;

    const timeA = a.start_time || '';
    const timeB = b.start_time || '';
    return timeA.localeCompare(timeB);
  });

  return (
    <>
      <div className="space-y-4">
        <div className={tutorTableShell}>
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={tutorTableHeaderRow}>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClasses.map((classItem: TutorClassRow) => {
                const subjectParts: string[] = [];
                if (classItem.subject_curriculum) subjectParts.push(classItem.subject_curriculum);
                if (classItem.subject_year_level !== null && classItem.subject_year_level !== undefined) {
                  subjectParts.push(String(classItem.subject_year_level));
                }
                if (classItem.subject_name) subjectParts.push(classItem.subject_name);
                if (classItem.subject_level ?? classItem.level) {
                  subjectParts.push(classItem.subject_level ?? classItem.level ?? '');
                }
                const subjectDisplay = subjectParts.join(' ') || '-';

                return (
                  <TableRow key={classItem.id || ''} className={tutorTableBodyRow}>
                    <TableCell className="font-medium">
                      {classItem.schedule_weekdays?.length
                        ? classItem.schedule_weekdays.map(getDayShortName).join(', ')
                        : classItem.day_of_week !== null ? getDayShortName(classItem.day_of_week) : '-'}
                    </TableCell>
                    <TableCell>
                      {classItem.schedule_summary_short || (classItem.start_time && classItem.end_time
                        ? `${formatTime(classItem.start_time)} - ${formatTime(classItem.end_time)}`
                        : '-')}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const subjectForColor = classItem.subject_color
                          ? ({ color: classItem.subject_color } as Tables<'subjects'>)
                          : null;
                        const { style, textColorClass } = getSubjectColorStyle(subjectForColor);
                        const defaultClass = !classItem.subject_color
                          ? 'bg-gray-100 text-gray-800 border-gray-300'
                          : '';
                        return (
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-normal',
                              defaultClass || textColorClass,
                              !defaultClass && 'border-0',
                            )}
                            style={style.backgroundColor ? style : undefined}
                          >
                            {subjectDisplay}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{classItem.room || '-'}</TableCell>
                    <TableCell className="text-right">
                      {classItem.id ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={tutorBtnOutline}
                          onClick={() => handleViewClass(classItem.id as string)}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          View
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedClassId ? (
        <ViewClassModal
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          classId={selectedClassId}
        />
      ) : null}
    </>
  );
}
