'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
import { SessionsTable } from '@/features/sessions/components/SessionsTable';
import { DateRangePicker } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { Alert, AlertDescription } from '@altitutor/ui';

interface AdminShiftSessionsTabProps {
  adminShiftData: Tables<'admin_shifts'>;
  adminShiftStaff: Tables<'staff'>[];
  adminShiftSessions: Tables<'sessions'>[];
}

// Get today's date in local timezone (YYYY-MM-DD format)
const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function AdminShiftSessionsTab({ adminShiftData, adminShiftStaff, adminShiftSessions }: AdminShiftSessionsTabProps) {
  // Filter state - default: use admin shift's session date range, or today if not set
  const today = getTodayLocalDate();
  
  // Calculate default start date: use session_start_date if set and >= today, otherwise use today
  const getDefaultStartDate = (): string => {
    if (adminShiftData.session_start_date) {
      const startDate = new Date(adminShiftData.session_start_date).toISOString().split('T')[0];
      return startDate >= today ? startDate : today;
    }
    return today;
  };
  
  // Calculate default end date: use session_end_date if set, otherwise use end of year
  const getDefaultEndDate = (): string => {
    if (adminShiftData.session_end_date) {
      return new Date(adminShiftData.session_end_date).toISOString().split('T')[0];
    }
    // Default to end of current year
    const year = new Date().getFullYear();
    return `${year}-12-31`;
  };
  
  const [dateRangeStart, setDateRangeStart] = useState<string>(getDefaultStartDate());
  const [dateRangeEnd, setDateRangeEnd] = useState<string>(getDefaultEndDate());
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');

  // Prepare filters for API - handle empty strings as undefined
  // If both dates are cleared, fetch all sessions
  const rangeStart = dateRangeStart && dateRangeStart.trim() !== '' ? dateRangeStart : undefined;
  const rangeEnd = dateRangeEnd && dateRangeEnd.trim() !== '' ? dateRangeEnd : undefined;
  const staffId = selectedStaffId !== 'ALL' ? selectedStaffId : undefined;

  // Filter sessions by date range and staff
  // Use the adminShiftSessions prop as base, then filter client-side
  const filteredSessions = useMemo(() => {
    let sessions = adminShiftSessions || [];
    
    // Filter by date range if provided
    if (rangeStart || rangeEnd) {
      sessions = sessions.filter(session => {
        if (!session.start_at) return false;
        const sessionDate = new Date(session.start_at).toISOString().split('T')[0];
        if (rangeStart && sessionDate < rangeStart) return false;
        if (rangeEnd && sessionDate > rangeEnd) return false;
        return true;
      });
    }
    
    return sessions;
  }, [adminShiftSessions, rangeStart, rangeEnd]);
  
  // Get session IDs for fetching full details
  const sessionIds = useMemo(() => filteredSessions.map(s => s.id), [filteredSessions]);
  
  // Fetch full details for filtered sessions
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['adminShiftSessionsDetails', sessionIds, staffId],
    queryFn: async () => {
      if (sessionIds.length === 0) {
        return {
          sessions: [],
          sessionStudents: {},
          sessionStaff: {},
          tutorLogs: {},
          classesById: {},
          subjectsById: {},
        };
      }
      
      // Get full details for the filtered sessions
      const result = await sessionsApi.getAllSessionsWithDetails({
        rangeStart: undefined, // Don't filter by date - we already filtered
        rangeEnd: undefined,
        staffId: staffId || undefined,
        includeInactive: false,
      });
      
      // Filter to only our admin shift sessions
      const sessionIdSet = new Set(sessionIds);
      const finalSessions = result.sessions.filter(s => sessionIdSet.has(s.id));
      
      // Filter by staff if provided (check sessions_staff table)
      let staffFilteredSessions = finalSessions;
      if (staffId) {
        const sessionsWithStaff = finalSessions.filter(s => {
          const staff = result.sessionStaff[s.id] || [];
          return staff.some(st => st.id === staffId);
        });
        staffFilteredSessions = sessionsWithStaff;
      }
      
      // Filter related data to only include our sessions
      const finalSessionStudents: Record<string, Array<Tables<'students'> & { planned_absence?: boolean; actual_attended?: boolean | null; invoice_status?: string | null; sessions_students_id?: string; is_extra?: boolean }>> = {};
      const finalSessionStaff: Record<string, Array<Tables<'staff'> & { planned_absence?: boolean; actual_attended?: boolean | null; is_swapped_in?: boolean }>> = {};
      const finalTutorLogs: Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }> = {};
      
      staffFilteredSessions.forEach(session => {
        const sessionIdStr = String(session.id);
        if (result.sessionStudents[sessionIdStr]) {
          finalSessionStudents[sessionIdStr] = result.sessionStudents[sessionIdStr];
        }
        if (result.sessionStaff[sessionIdStr]) {
          finalSessionStaff[sessionIdStr] = result.sessionStaff[sessionIdStr];
        }
        if (result.tutorLogs[sessionIdStr]) {
          finalTutorLogs[sessionIdStr] = result.tutorLogs[sessionIdStr];
        }
      });
      
      return {
        sessions: staffFilteredSessions,
        sessionStudents: finalSessionStudents,
        sessionStaff: finalSessionStaff,
        tutorLogs: finalTutorLogs,
        classesById: result.classesById,
        subjectsById: result.subjectsById,
      };
    },
    enabled: !!adminShiftData.id && sessionIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  // Sort staff for dropdown
  const sortedStaff = useMemo(() => {
    return [...adminShiftStaff].sort((a, b) => {
      const aName = `${a.first_name || ''} ${a.last_name || ''}`.trim();
      const bName = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      return aName.localeCompare(bName);
    });
  }, [adminShiftStaff]);

  const handleOpenSession = useCallback((sessionId: string) => {
    window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
  }, []);

  const handleOpenStaff = useCallback((staffId: string) => {
    window.dispatchEvent(new CustomEvent('open-staff-modal', { detail: { id: staffId } }));
  }, []);

  // Get filtered sessions count
  const filteredSessionsCount = sessionsData?.sessions.length || 0;

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

        {/* Staff Filter */}
        {sortedStaff.length > 0 && (
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
        )}
      </div>

      {/* Sessions Table - Note: Shows all sessions, filtering happens client-side above */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading sessions...</p>
          </div>
        ) : filteredSessionsCount === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">No sessions found for this admin shift in the selected date range.</p>
          </div>
        ) : (
          <SessionsTable
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            staffId={staffId}
            onOpenSession={handleOpenSession}
            onOpenStaff={handleOpenStaff}
            hideStudentFilter={true}
          />
        )}
      </div>
    </div>
  );
}
