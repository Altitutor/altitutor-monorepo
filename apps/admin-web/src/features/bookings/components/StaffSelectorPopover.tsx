import { useState } from 'react';
import { Input, Button, Popover, PopoverContent, PopoverTrigger, ScrollArea } from '@altitutor/ui';
import { Search, Loader2, Check } from 'lucide-react';
import { useStaffSearch } from '../hooks/useStaffSearch';
import type { Tables } from '@altitutor/shared';

interface StaffSelectorPopoverProps {
  selectedStaff: Tables<'staff'> | null;
  onSelectStaff: (staff: Tables<'staff'>) => void;
  disabled?: boolean;
}

export function StaffSelectorPopover({
  selectedStaff,
  onSelectStaff,
  disabled = false,
}: StaffSelectorPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: searchResults, isLoading } = useStaffSearch(searchQuery, {
    enabled: isOpen || searchQuery.trim().length > 0,
    limit: 100,
  });

  const staffList = searchResults?.staff || [];

  const handleSelect = (staff: Tables<'staff'>) => {
    onSelectStaff(staff);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
        >
          {selectedStaff 
            ? `${selectedStaff.first_name} ${selectedStaff.last_name}` 
            : 'Select staff member'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[400px]" align="start">
        <div className="p-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search staff by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          <ScrollArea className="h-[300px]">
            <div className="space-y-1 pr-4">
              {isLoading ? (
                <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              ) : staffList.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  {searchQuery.trim()
                    ? 'No staff found'
                    : 'Start typing to search for staff'}
                </div>
              ) : (
                staffList.map((staff) => (
                  <Button
                    key={staff.id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => handleSelect(staff)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {selectedStaff?.id === staff.id && <Check className="h-4 w-4" />}
                      <div className="flex flex-col items-start flex-1">
                        <div className={selectedStaff?.id === staff.id ? 'font-medium' : ''}>
                          {staff.first_name} {staff.last_name}
                        </div>
                        {staff.email && (
                          <div className="text-xs text-muted-foreground">
                            {staff.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
