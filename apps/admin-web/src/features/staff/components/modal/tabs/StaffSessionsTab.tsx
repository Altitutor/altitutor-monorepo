'use client';

import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';
import { useStaffClasses } from '@/features/staff/hooks/useStaffClasses';
import { DateRangePicker } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Filter, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

interface StaffSessionsTabProps {
  staff: Tables<'staff'>;
}

// Get today's date in local timezone (YYYY-MM-DD format)
const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function StaffSessionsTab({ staff }: StaffSessionsTabProps) {
  // Filter state - default: both dates today, class unset
  const today = getTodayLocalDate();
  const [dateRangeStart, setDateRangeStart] = useState<string>(today);
  const [dateRangeEnd, setDateRangeEnd] = useState<string>(today);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  
  // Student filter state
  const [studentFilters, setStudentFilters] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');

  // Get staff classes for filter
  const { data: staffClassesData = [] } = useStaffClasses(staff.id);

  // Search students using RPC
  const { data: studentSearchResults } = useQuery({
    queryKey: ['students', 'search', studentSearchQuery.trim()],
    queryFn: async () => {
      const trimmed = studentSearchQuery.trim();
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: ['ACTIVE', 'TRIAL'],
        p_include_relationships: false,
        p_exclude_class_search: false,
        p_limit: 100,
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return { students: [], total: 0 };

      const rpcData = rpcResult as { students: any[]; total: number };
      const students = (rpcData.students || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status,
        curriculum: s.curriculum || null,
        year_level: s.year_level || null,
        school: s.school || null,
        email: s.email || null,
        phone: s.phone || null,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'students'>[];
      
      return {
        students,
        total: rpcData.total || 0,
      };
    },
    enabled: studentSearchQuery.trim().length > 0,
    staleTime: 1000 * 30,
  });

  const filteredStudents = studentSearchResults?.students || [];

  const toggleStudentFilter = useCallback((studentId: string) => {
    setStudentFilters(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  }, []);

  // Prepare filters for API
  const rangeStart = dateRangeStart || undefined;
  const rangeEnd = dateRangeEnd || undefined;
  const classId = selectedClassId !== 'ALL' ? selectedClassId : undefined;
  // Pass single studentId if only one selected, otherwise filter client-side
  const studentId = studentFilters.length === 1 ? studentFilters[0] : undefined;

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
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={studentFilters.length > 0 ? "secondary" : "outline"} 
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Student {studentFilters.length > 0 && `(${studentFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[400px]" align="start">
              <div className="p-3">
                <Input
                  placeholder="Search students..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1 pr-4">
                    {filteredStudents.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {studentSearchQuery
                          ? 'No students match your search'
                          : 'Type to search for students'}
                      </div>
                    ) : (
                      filteredStudents.map((student) => (
                        <label
                          key={student.id}
                          className="flex items-center gap-2 cursor-pointer p-2 hover:bg-muted rounded"
                        >
                          <Checkbox
                            checked={studentFilters.includes(student.id)}
                            onCheckedChange={() => toggleStudentFilter(student.id)}
                          />
                          <div className="flex flex-col items-start flex-1">
                            <div className="font-medium text-sm">
                              {student.first_name} {student.last_name}
                            </div>
                            {student.school && (
                              <div className="text-xs text-muted-foreground">
                                {student.school}
                              </div>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
                {studentFilters.length > 0 && (
                  <div className="p-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStudentFilters([])}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear ({studentFilters.length})
                    </Button>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Class Filter */}
        <div>
          <label className="block text-sm mb-1">Class</label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Classes</SelectItem>
              {staffClassesData.map((sc) => (
                <SelectItem key={sc.class.id} value={sc.class.id}>
                  {sc.subject ? `${sc.subject.curriculum || ''} ${sc.subject.year_level || ''} ${sc.subject.name || ''}`.trim() : `Class ${sc.class.id.substring(0, 8)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SessionsTable
          staffId={staff.id}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          classId={classId}
          studentId={studentId}
          onOpenSession={handleOpenSession}
          onOpenStudent={handleOpenStudent}
          onOpenStaff={handleOpenStaff}
          hideBilling={true}
          hideStudentFilter={true}
          hideTypeFilter={true}
          hideSearch={true}
          initialStudentFilters={studentFilters}
        />
      </div>
    </div>
  );
}
