'use client';

import { useState, useMemo } from 'react';
import { Input } from '@altitutor/ui';
import { Search, ChevronDown } from 'lucide-react';
import { StaffCard } from '@/shared/components/StaffCard';
import { useAvailableReplacementStaff } from '../../hooks';
import type { ReplacementStaff } from '../../types/staff-absence';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@altitutor/ui';

interface ReplacementStaffDropdownProps {
  sessionId: string;
  subjectId: string;
  excludeStaffIds: string[];
  onSelect: (staffId: string, staff: ReplacementStaff) => void;
  selectedStaffId?: string;
}

export function ReplacementStaffDropdown({
  sessionId,
  subjectId,
  excludeStaffIds,
  onSelect,
  selectedStaffId,
}: ReplacementStaffDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { data: availableStaff, isLoading } = useAvailableReplacementStaff({
    sessionId,
    subjectId,
    excludeStaffIds,
  });

  const filteredStaff = useMemo(() => {
    if (!availableStaff) return [];
    if (!searchQuery.trim()) return availableStaff;

    const query = searchQuery.toLowerCase();
    return availableStaff.filter((staff) => {
      const fullName = `${staff.first_name} ${staff.last_name}`.toLowerCase();
      const email = (staff.email || '').toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  }, [availableStaff, searchQuery]);

  const selectedStaff = useMemo(() => {
    if (!selectedStaffId || !availableStaff) return null;
    return availableStaff.find((s) => s.id === selectedStaffId) || null;
  }, [selectedStaffId, availableStaff]);

  const handleSelect = (staff: ReplacementStaff) => {
    onSelect(staff.id, staff);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full p-3 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left flex items-center justify-between"
        >
          <span className="text-sm text-muted-foreground">
            {selectedStaff
              ? `${selectedStaff.first_name} ${selectedStaff.last_name}`
              : 'Select replacement staff...'}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search staff by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading staff...
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery.trim()
                ? 'No staff found matching your search'
                : 'No available replacement staff'}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredStaff.map((staff) => (
                <div
                  key={staff.id}
                  onClick={() => handleSelect(staff)}
                  className="cursor-pointer"
                >
                  <StaffCard
                    staff={staff}
                    subjects={staff.subjects}
                    isSelecting={true}
                    isSelected={selectedStaffId === staff.id}
                    showActions={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

