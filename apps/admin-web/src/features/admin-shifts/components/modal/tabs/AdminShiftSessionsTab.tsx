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

export function AdminShiftSessionsTab({ adminShiftData, adminShiftStaff }: AdminShiftSessionsTabProps) {
  // Filter state - default: both dates today, staff unset
  const today = getTodayLocalDate();
  const [dateRangeStart, setDateRangeStart] = useState<string>(today);
  const [dateRangeEnd, setDateRangeEnd] = useState<string>(today);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');

  // Prepare filters for API
  const rangeStart = dateRangeStart || undefined;
  const rangeEnd = dateRangeEnd || undefined;
  const staffId = selectedStaffId !== 'ALL' ? selectedStaffId : undefined;

  // Fetch sessions filtered by admin_shift_id
  // Note: Currently filtering client-side until search_sessions_admin RPC supports admin_shift_id
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['adminShiftSessions', adminShiftData.id, rangeStart, rangeEnd, staffId],
    queryFn: async () => {
      const result = await sessionsApi.getAllSessionsWithDetails({
        rangeStart,
        rangeEnd,
        staffId,
        includeInactive: false,
      });
      
      // Filter to only sessions for this admin shift
      const filteredSessions = result.sessions.filter(
        session => session.admin_shift_id === adminShiftData.id
      );
      
      return {
        ...result,
        sessions: filteredSessions,
      };
    },
    enabled: !!adminShiftData.id,
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
      {/* Info Alert */}
      <Alert>
        <AlertDescription>
          Showing sessions for this admin shift. {filteredSessionsCount} session{filteredSessionsCount !== 1 ? 's' : ''} found in the selected date range.
        </AlertDescription>
      </Alert>

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
