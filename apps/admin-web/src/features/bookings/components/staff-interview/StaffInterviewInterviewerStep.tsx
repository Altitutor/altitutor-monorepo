'use client';

import { Input } from '@altitutor/ui';
import { Loader2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { staffApi } from '@/features/staff/api/staff';
import { staffKeys } from '@/features/staff/hooks/useStaffQuery';
import { StaffCard } from '@/shared/components/StaffCard';
import type { Tables } from '@altitutor/shared';

export interface StaffInterviewInterviewerStepProps {
  interviewerSearch: string;
  onInterviewerSearchChange: (value: string) => void;
  selectedInterviewerId: string;
  onSelectInterviewer: (id: string) => void;
  intervieweeStaffId: string;
}

export function StaffInterviewInterviewerStep({
  interviewerSearch,
  onInterviewerSearchChange,
  selectedInterviewerId,
  onSelectInterviewer,
  intervieweeStaffId,
}: StaffInterviewInterviewerStepProps) {
  const { data: staffData, isLoading } = useQuery({
    queryKey: staffKeys.minimal({
      search: interviewerSearch,
      statuses: ['ACTIVE'],
      limit: 50,
    }),
    queryFn: () =>
      staffApi.listMinimal({
        search: interviewerSearch,
        statuses: ['ACTIVE'],
        limit: 50,
        offset: 0,
        orderBy: 'first_name',
        ascending: true,
      }),
    enabled: true,
    staleTime: 1000 * 30,
  });

  const staffList = staffData?.staff ?? [];
  const filteredStaff = staffList.filter((s) => s.id !== intervieweeStaffId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select the staff member conducting the interview
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search staff..."
          value={interviewerSearch}
          onChange={(e) => onInterviewerSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredStaff.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground text-center">
          {interviewerSearch
            ? 'No ACTIVE staff found matching your search'
            : 'Start typing to search for staff'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredStaff.map((staffMember) => (
            <StaffCard
              key={staffMember.id}
              staff={staffMember as Tables<'staff'>}
              subjects={[]}
              showSubjects={false}
              showActions={false}
              isSelecting
              isSelected={selectedInterviewerId === staffMember.id}
              onClick={() => onSelectInterviewer(staffMember.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
