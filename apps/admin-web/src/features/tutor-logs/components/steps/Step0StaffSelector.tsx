'use client';

import { useState, useEffect } from 'react';
import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Search } from 'lucide-react';
import { staffApi, type StaffListItem } from '@/features/staff/api/staff';
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
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;

  useEffect(() => {
    const fetchStaff = async () => {
      setIsLoading(true);
      try {
        const result = await staffApi.listMinimal({
          search: searchTerm || undefined,
          limit,
          offset: 0,
          orderBy: 'first_name',
          ascending: true,
        });
        setStaff(result.staff);
        setHasMore(result.staff.length === limit);
        setOffset(result.staff.length);
      } catch (error) {
        console.error('Error fetching staff:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStaff();
  }, [searchTerm]);

  const loadMore = async () => {
    if (!hasMore || isLoading) return;
    setIsLoading(true);
    try {
      const result = await staffApi.listMinimal({
        search: searchTerm || undefined,
        limit,
        offset,
        orderBy: 'first_name',
        ascending: true,
      });
      setStaff((prev) => [...prev, ...result.staff]);
      setHasMore(result.staff.length === limit);
      setOffset((prev) => prev + result.staff.length);
    } catch (error) {
      console.error('Error loading more staff:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
          {hasMore && (
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

