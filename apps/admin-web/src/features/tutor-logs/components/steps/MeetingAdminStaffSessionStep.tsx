'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label, SearchableSelect } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { staffApi } from '@/features/staff/api/staff';
import { getShortSessionName } from '@/features/sessions/utils/session-helpers';
import { useUnloggedSessionsForStaff } from '../../hooks';

type MeetingAdminStaffSessionStepProps = {
  selectedStaffId: string | undefined;
  onStaffChange: (staffId: string) => void;
  selectedSessionId: string | undefined;
  onSessionChange: (sessionId: string) => void;
};

export function MeetingAdminStaffSessionStep({
  selectedStaffId,
  onStaffChange,
  selectedSessionId,
  onSessionChange,
}: MeetingAdminStaffSessionStepProps) {
  const [staffSearch, setStaffSearch] = useState('');
  const [debouncedStaffSearch, setDebouncedStaffSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedStaffSearch(staffSearch), 250);
    return () => clearTimeout(t);
  }, [staffSearch]);

  const { data: staffRows = [], isFetching: staffLoading } = useQuery({
    queryKey: ['log-session-staff-select', debouncedStaffSearch],
    queryFn: async () => {
      const { staff } = await staffApi.listMinimal({
        search: debouncedStaffSearch,
        statuses: ['ACTIVE', 'TRIAL'],
        limit: 40,
        offset: 0,
        orderBy: 'first_name',
        ascending: true,
      });
      return staff as Tables<'staff'>[];
    },
    staleTime: 30_000,
  });

  const { data: unlogged, isLoading: sessionsLoading } = useUnloggedSessionsForStaff(
    selectedStaffId || undefined
  );

  const sessions = unlogged?.sessions ?? [];

  const selectedStaff = useMemo(
    () => staffRows.find((s) => s.id === selectedStaffId) ?? null,
    [staffRows, selectedStaffId]
  );

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Staff member</Label>
        <SearchableSelect<Tables<'staff'>>
          items={staffRows}
          value={selectedStaff}
          onValueChange={(row) => {
            if (row) {
              onStaffChange(row.id);
              onSessionChange('');
            }
          }}
          getItemLabel={(s) => `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()}
          getItemId={(s) => s.id}
          onSearchChange={setStaffSearch}
          loading={staffLoading}
          placeholder="Search staff…"
          searchPlaceholder="Type to search…"
          disabled={false}
        />
      </div>

      <div className="space-y-2">
        <Label>Session</Label>
        <SearchableSelect<Tables<'sessions'>>
          items={sessions}
          value={selectedSession}
          onValueChange={(row) => row && onSessionChange(row.id)}
          getItemLabel={(s) => s.long_name?.trim() || getShortSessionName(s)}
          getItemValue={(s) =>
            [s.long_name, s.short_name, s.id].filter(Boolean).join(' ')
          }
          getItemId={(s) => s.id}
          placeholder={selectedStaffId ? 'Select session…' : 'Choose staff first'}
          searchPlaceholder="Filter sessions…"
          loading={sessionsLoading}
          disabled={!selectedStaffId}
        />
      </div>
    </div>
  );
}
