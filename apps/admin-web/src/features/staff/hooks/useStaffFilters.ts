import { useState, useMemo, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { useDebounce } from '@/shared/hooks';

interface StaffFilters {
  searchTerm: string;
  roleFilter: 'TUTOR' | 'ADMINSTAFF' | 'ALL';
  statusFilter: 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'ALL';
  sortField: keyof Tables<'staff'>;
  sortDirection: 'asc' | 'desc';
}

interface UseStaffFiltersReturn {
  filteredStaff: Tables<'staff'>[];
  filters: StaffFilters;
  setSearchTerm: (term: string) => void;
  setRoleFilter: (role: 'TUTOR' | 'ADMINSTAFF' | 'ALL') => void;
  setStatusFilter: (status: 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'ALL') => void;
  handleSort: (field: keyof Tables<'staff'>) => void;
  resetFilters: () => void;
}

const initialFilters: StaffFilters = {
  searchTerm: '',
  roleFilter: 'ALL',
  statusFilter: 'ALL',
  sortField: 'last_name',
  sortDirection: 'asc',
};

export function useStaffFilters(staffMembers: Tables<'staff'>[]): UseStaffFiltersReturn {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'TUTOR' | 'ADMINSTAFF' | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Tables<'staff'>>('last_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const handleSort = useCallback((field: keyof Tables<'staff'>) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setSortField('last_name');
    setSortDirection('asc');
  }, []);

  const filteredStaff = useMemo(() => {
    if (!staffMembers.length) return [];
    
    let result = [...staffMembers];
    
    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      result = result.filter(staff =>
        (staff.first_name?.toLowerCase() || '').includes(searchLower) ||
        (staff.last_name?.toLowerCase() || '').includes(searchLower) ||
        (staff.email?.toLowerCase() || '').includes(searchLower) ||
        (staff.phone_number?.toLowerCase() || '').includes(searchLower)
      );
    }
    
    // Apply role filter
    if (roleFilter !== 'ALL') {
      result = result.filter(staff => staff.role === roleFilter);
    }
    
    // Apply status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(staff => staff.status === statusFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const valueA = a[sortField] || '' as any;
      const valueB = b[sortField] || '' as any;
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }
      
      return 0;
    });
    
    return result;
  }, [staffMembers, debouncedSearchTerm, roleFilter, statusFilter, sortField, sortDirection]);

  return {
    filteredStaff,
    filters: {
      searchTerm,
      roleFilter,
      statusFilter,
      sortField,
      sortDirection,
    },
    setSearchTerm,
    setRoleFilter,
    setStatusFilter,
    handleSort,
    resetFilters,
  };
} 