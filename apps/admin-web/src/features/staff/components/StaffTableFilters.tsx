'use client';

import { memo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Filter,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
type StaffRole = 'ADMINSTAFF' | 'TUTOR' | 'ADMIN';
type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'TRIAL';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StaffTableFiltersProps {
  searchTerm: string;
  roleFilter: StaffRole | 'ALL';
  statusFilter: StaffStatus | 'ALL';
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (role: StaffRole | 'ALL') => void;
  onStatusFilterChange: (status: StaffStatus | 'ALL') => void;
  onRefresh: () => void;
  onResetFilters: () => void;
  isLoading?: boolean;
}

export const StaffTableFilters = memo(function StaffTableFilters({
  searchTerm,
  roleFilter,
  statusFilter,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onRefresh,
  onResetFilters,
  isLoading = false,
}: StaffTableFiltersProps) {
  return (
    <div className="flex justify-between items-center gap-4">
      <div className="relative w-64">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search staff..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Role: {roleFilter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRoleFilterChange('ALL')}>
              All Roles
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRoleFilterChange('ADMINSTAFF')}>
              Admin Staff
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRoleFilterChange('TUTOR')}>
              Tutor
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Status: {statusFilter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onStatusFilterChange('ALL')}>
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusFilterChange('ACTIVE')}>
              Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusFilterChange('INACTIVE')}>
              Inactive
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusFilterChange('TRIAL')}>
              Trial
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={onResetFilters}
          disabled={isLoading}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh} 
          disabled={isLoading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  );
}); 