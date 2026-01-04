'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import type { Tables } from '@altitutor/shared';
import { useStudentClasses } from '../hooks';
import { cn } from '@/shared/utils';
import { getSubjectColorStyle } from '@/shared/utils';
import { formatTime, getDayShortName } from '@/shared/utils/datetime';
import { Loader2 } from 'lucide-react';

interface ClassesTableProps {
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function ClassesTable({}: ClassesTableProps) {
  const { data: classes, isLoading, error } = useStudentClasses();
  const [searchTerm] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading classes: {error.message}
      </div>
    );
  }

  if (!classes || classes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        You are not enrolled in any classes yet.
      </div>
    );
  }

  // Filter classes by search term
  const filteredClasses = classes.filter((c) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      c.subject_name?.toLowerCase().includes(searchLower) ||
      c.room?.toLowerCase().includes(searchLower) ||
      (c.day_of_week !== null && DAYS[c.day_of_week - 1]?.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Room</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredClasses.map((classItem) => {
            // Format subject as {curriculum} {year_level} {name} {level}
            const subjectParts: string[] = [];
            if (classItem.subject_curriculum) {
              subjectParts.push(classItem.subject_curriculum);
            }
            if (classItem.subject_year_level !== null && classItem.subject_year_level !== undefined) {
              subjectParts.push(String(classItem.subject_year_level));
            }
            if (classItem.subject_name) {
              subjectParts.push(classItem.subject_name);
            }
            if (classItem.class_level) {
              subjectParts.push(classItem.class_level);
            }
            const subjectDisplay = subjectParts.join(' ') || '-';

            return (
              <TableRow 
                key={classItem.enrollment_id || ''}
              >
                <TableCell className="font-medium">
                  {classItem.day_of_week !== null ? getDayShortName(classItem.day_of_week) : '-'}
                </TableCell>
                <TableCell>
                  {classItem.start_time && classItem.end_time 
                    ? `${formatTime(classItem.start_time)} - ${formatTime(classItem.end_time)}`
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  {(() => {
                    // Create a minimal subject-like object for getSubjectColorStyle
                    const subjectForColor = classItem.subject_color 
                      ? { color: classItem.subject_color } as Pick<Tables<'subjects'>, 'color'>
                      : null;
                    const { style, textColorClass } = getSubjectColorStyle(subjectForColor);
                    const defaultClass = !classItem.subject_color ? 'bg-gray-100 text-gray-800 border-gray-300' : '';
                    return (
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          defaultClass || textColorClass,
                          !defaultClass && 'border-0'
                        )}
                        style={style.backgroundColor ? style : undefined}
                      >
                        {subjectDisplay}
                      </Badge>
                    );
                  })()}
                </TableCell>
                <TableCell>{classItem.room || '-'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

