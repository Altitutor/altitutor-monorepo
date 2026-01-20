'use client';

import { memo } from 'react';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@altitutor/ui";
import { 
  Search, 
  Filter,
  X
} from 'lucide-react';

interface StaffTableFiltersProps {
  searchTerm: string;
  roleFilters: string[];
  statusFilters: string[];
  onSearchChange: (value: string) => void;
  onRoleFiltersChange: (roles: string[]) => void;
  onStatusFiltersChange: (statuses: string[]) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
}

export const StaffTableFilters = memo(function StaffTableFilters({
  searchTerm,
  roleFilters,
  statusFilters,
  onSearchChange,
  onRoleFiltersChange,
  onStatusFiltersChange,
  onResetFilters,
  isLoading = false,
}: StaffTableFiltersProps) {
  const toggleRoleFilter = (role: string) => {
    onRoleFiltersChange(
      roleFilters.includes(role)
        ? roleFilters.filter(r => r !== role)
        : [...roleFilters, role]
    );
  };

  const toggleStatusFilter = (status: string) => {
    onStatusFiltersChange(
      statusFilters.includes(status)
        ? statusFilters.filter(s => s !== status)
        : [...statusFilters, status]
    );
  };

  // Count active filters - default is ACTIVE status only
  const activeFiltersCount = 
    (roleFilters.length > 0 ? 1 : 0) +
    (statusFilters.length !== 1 || !statusFilters.includes('ACTIVE') ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search staff..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <div className="flex flex-wrap items-center gap-2">
        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onResetFilters}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}

        {/* Role Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={roleFilters.length > 0 ? "secondary" : "outline"} 
              size="sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Role {roleFilters.length > 0 && `(${roleFilters.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="space-y-2">
              <div className="font-medium text-sm mb-2">Staff Role</div>
              {(['ADMINSTAFF', 'TUTOR', 'ADMIN'] as const).map((role) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={roleFilters.includes(role)}
                    onCheckedChange={() => toggleRoleFilter(role)}
                  />
                  <span className="text-sm">{role === 'ADMINSTAFF' ? 'Admin Staff' : role}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={statusFilters.length > 0 ? "secondary" : "outline"} 
              size="sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Status {statusFilters.length > 0 && `(${statusFilters.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="space-y-2">
              <div className="font-medium text-sm mb-2">Staff Status</div>
              {(['ACTIVE', 'INACTIVE', 'TRIAL'] as const).map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={statusFilters.includes(status)}
                    onCheckedChange={() => toggleStatusFilter(status)}
                  />
                  <span className="text-sm">{status}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}); 