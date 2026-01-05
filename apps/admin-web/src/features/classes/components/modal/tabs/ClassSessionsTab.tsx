'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';
import { DateRangePicker } from '@/shared/components/DateRangePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';

interface ClassSessionsTabProps {
  classData: Tables<'classes'>;
  classStudents: Tables<'students'>[];
  classStaff: Tables<'staff'>[];
}

// Get today's date in local timezone (YYYY-MM-DD format)
const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function ClassSessionsTab({ classData, classStudents, classStaff }: ClassSessionsTabProps) {
  // Filter state - default: both dates today, student unset, staff unset
  const today = getTodayLocalDate();
  const [dateRangeStart, setDateRangeStart] = useState<string>(today);
  const [dateRangeEnd, setDateRangeEnd] = useState<string>(today);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('ALL');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');

  // Prepare filters for API
  const rangeStart = dateRangeStart || undefined;
  const rangeEnd = dateRangeEnd || undefined;
  const studentId = selectedStudentId !== 'ALL' ? selectedStudentId : undefined;
  const staffId = selectedStaffId !== 'ALL' ? selectedStaffId : undefined;

  // Sort students and staff for dropdowns
  const sortedStudents = useMemo(() => {
    return [...classStudents].sort((a, b) => {
      const aName = `${a.first_name || ''} ${a.last_name || ''}`.trim();
      const bName = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      return aName.localeCompare(bName);
    });
  }, [classStudents]);

  const sortedStaff = useMemo(() => {
    return [...classStaff].sort((a, b) => {
      const aName = `${a.first_name || ''} ${a.last_name || ''}`.trim();
      const bName = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      return aName.localeCompare(bName);
    });
  }, [classStaff]);

  const handleOpenSession = useCallback((sessionId: string) => {
    window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
  }, []);

  const handleOpenStudent = useCallback((studentId: string) => {
    window.dispatchEvent(new CustomEvent('open-student-modal', { detail: { id: studentId } }));
  }, []);

  const handleOpenStaff = useCallback((staffId: string) => {
    window.dispatchEvent(new CustomEvent('open-staff-modal', { detail: { id: staffId } }));
  }, []);

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date Range */}
        <div>
          <label className="block text-sm mb-1">Date Range</label>
          <DateRangePicker
            from={dateRangeStart}
            to={dateRangeEnd}
            onFromChange={setDateRangeStart}
            onToChange={setDateRangeEnd}
          />
        </div>

        {/* Student Filter */}
        <div>
          <label className="block text-sm mb-1">Student</label>
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Students</SelectItem>
              {sortedStudents.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.first_name} {student.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Staff Filter */}
        <div>
          <label className="block text-sm mb-1">Staff</label>
          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Staff</SelectItem>
              {sortedStaff.map((staff) => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.first_name} {staff.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SessionsTable
          classId={classData.id}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          studentId={studentId}
          staffId={staffId}
          onOpenSession={handleOpenSession}
          onOpenStudent={handleOpenStudent}
          onOpenStaff={handleOpenStaff}
        />
      </div>
    </div>
  );
}
