import { useState, useMemo, useCallback } from 'react';
import type { Staff, StaffRole, StaffStatus } from '../types';
import { useDebounce } from '@/hooks/useDebounce';

interface StaffFilters {
  searchTerm: string;
  roleFilter: StaffRole | 'ALL';
  statusFilter: StaffStatus | 'ALL';
  sortField: keyof Staff;
  sortDirection: 'asc' | 'desc';
}

interface UseStaffFiltersReturn {
  filteredStaff: Staff[];
  filters: StaffFilters;
  setSearchTerm: (term: string) => void;
  setRoleFilter: (role: StaffRole | 'ALL') => void;
  setStatusFilter: (status: StaffStatus | 'ALL') => void;
  handleSort: (field: keyof Staff) => void;
  resetFilters: () => void;
}

const initialFilters: StaffFilters = {
  searchTerm: '',
  roleFilter: 'ALL',
  statusFilter: 'ALL',
  sortField: 'lastName',
  sortDirection: 'asc',
};

export function useStaffFilters(staffMembers: Staff[]): UseStaffFiltersReturn {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Staff>('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const handleSort = useCallback((field: keyof Staff) => {
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
    setSortField('lastName');
    setSortDirection('asc');
  }, []);

  const filteredStaff = useMemo(() => {
    if (!staffMembers.length) return [];
    
    let result = [...staffMembers];
    
    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      result = result.filter(staff => 
        (staff.firstName?.toLowerCase() || '').includes(searchLower) ||
        (staff.lastName?.toLowerCase() || '').includes(searchLower) ||
        (staff.email?.toLowerCase() || '').includes(searchLower) ||
        (staff.phoneNumber?.toLowerCase() || '').includes(searchLower)
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
      const valueA = a[sortField] || '';
      const valueB = b[sortField] || '';
      
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