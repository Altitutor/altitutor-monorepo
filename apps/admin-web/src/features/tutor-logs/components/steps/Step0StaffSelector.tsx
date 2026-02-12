'use client';

import { useState } from 'react';
import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Search } from 'lucide-react';
import { useStaffListInfinite } from '@/features/staff/hooks/useStaffQuery';
import { StaffCard } from '@/shared/components/StaffCard';
import type { Tables } from '@altitutor/shared';

type Step0StaffSelectorProps = {
  title?: string;
  selectedStaffId?: string;
  onSelectStaff: (staffId: string) => void;
};

export function Step0StaffSelector({
  title,
  selectedStaffId,
  onSelectStaff,
}: Step0StaffSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useStaffListInfinite(searchTerm, 50);
  const staff = data?.pages.flatMap((p) => p.staff) ?? [];

  return (
    <div className="space-y-4">
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <p className="text-sm text-muted-foreground">
        Select which staff member you're logging this session for.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search staff by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          autoFocus
        />
      </div>

      {isLoading && staff.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Loading staff...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No staff found</div>
      ) : (
        <div className="space-y-3">
          {staff.map((staffMember) => (
            <div
              key={staffMember.id}
              onClick={() => onSelectStaff(staffMember.id)}
              className={selectedStaffId && staffMember.id === selectedStaffId ? 'ring-2 ring-primary rounded-lg' : ''}
            >
              <StaffCard
                staff={staffMember as Tables<'staff'>}
                showSubjects={false}
                showActions={false}
                isSelecting={true}
                isSelected={selectedStaffId ? staffMember.id === selectedStaffId : false}
              />
            </div>
          ))}
          {hasNextPage && (
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

