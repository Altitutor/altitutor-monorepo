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
import { useStudentClasses } from '../hooks';
import { cn, formatSubjectDisplay } from '@/shared/utils';
import { getSubjectCurriculumColor } from '@/shared/utils/enum-colors';
import { formatTime, getDayShortName } from '@/shared/utils/datetime';
import { Loader2 } from 'lucide-react';

interface ClassesTableProps {
  onClassClick?: (classId: string) => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function ClassesTable({ onClassClick }: ClassesTableProps) {
  const { data: classes, isLoading, error } = useStudentClasses();
  const [searchTerm, setSearchTerm] = useState('');

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
      DAYS[c.day_of_week - 1]?.toLowerCase().includes(searchLower)
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
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredClasses.map((classItem) => (
            <TableRow 
              key={classItem.enrollment_id}
              className={cn(
                "cursor-pointer",
                onClassClick && "hover:bg-muted/50"
              )}
              onClick={() => onClassClick?.(classItem.class_id)}
            >
              <TableCell className="font-medium">
                {getDayShortName(classItem.day_of_week)}
              </TableCell>
              <TableCell>
                {formatTime(classItem.start_time)} - {formatTime(classItem.end_time)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      getSubjectCurriculumColor(classItem.subject_curriculum)
                    )}
                  >
                    {classItem.subject_curriculum}
                  </Badge>
                  <span>{classItem.subject_name}</span>
                </div>
              </TableCell>
              <TableCell>{classItem.room || '-'}</TableCell>
              <TableCell>
                <Badge
                  variant={classItem.enrollment_status === 'ACTIVE' ? 'default' : 'secondary'}
                >
                  {classItem.enrollment_status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

