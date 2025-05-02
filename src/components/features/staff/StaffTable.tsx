'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  ArrowUpDown,
  Filter,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Staff, StaffRole, StaffStatus } from '@/lib/supabase/db/types';
import { staffApi } from '@/lib/supabase/api';
import { cn } from '@/lib/utils/index';
import { AddStaffModal } from './AddStaffModal';
import { ViewStaffModal } from './ViewStaffModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StaffTableProps {
  onRefresh?: number;
}

export function StaffTable({ onRefresh }: StaffTableProps = {}) {
  const router = useRouter();
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Staff>('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Load data
  const loadStaff = async () => {
    try {
      setLoading(true);
      const data = await staffApi.getAllStaff();
      console.log("Staff data loaded:", data); // Debug log to check data structure
      setStaffMembers(data);
    } catch (err) {
      console.error('Failed to load staff:', err);
      setError('Failed to load staff. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize and refresh data
  useEffect(() => {
    loadStaff();
  }, [onRefresh]);

  // Apply filters and sorting
  useEffect(() => {
    if (!staffMembers) return;
    
    let result = [...staffMembers];
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
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
    
    setFilteredStaff(result);
  }, [staffMembers, searchTerm, roleFilter, statusFilter, sortField, sortDirection]);

  const handleSort = (field: keyof Staff) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const getRoleBadgeColor = (role: StaffRole) => {
    switch (role) {
      case StaffRole.ADMIN:
        return 'bg-purple-100 text-purple-800';
      case StaffRole.TUTOR:
        return 'bg-blue-100 text-blue-800';
      case StaffRole.ADMINSTAFF:
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusBadgeColor = (status: StaffStatus) => {
    switch (status) {
      case StaffStatus.ACTIVE:
        return 'bg-green-100 text-green-800';
      case StaffStatus.INACTIVE:
        return 'bg-gray-100 text-gray-800';
      case StaffStatus.TRIAL:
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const handleStaffClick = (id: string) => {
    setSelectedStaffId(id);
    setIsViewModalOpen(true);
  };

  const handleStaffUpdated = () => {
    loadStaff();
  };

  const handleAddStaffClick = () => {
    setIsAddModalOpen(true);
  };

  if (loading && staffMembers.length === 0) {
    return <div className="flex justify-center p-4">Loading staff...</div>;
  }

  if (error && staffMembers.length === 0) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
              <DropdownMenuItem onClick={() => setRoleFilter('ALL')}>
                All Roles
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRoleFilter(StaffRole.ADMINSTAFF)}>
                Admin Staff
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRoleFilter(StaffRole.TUTOR)}>
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
              <DropdownMenuItem onClick={() => setStatusFilter('ALL')}>
                All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(StaffStatus.ACTIVE)}>
                Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(StaffStatus.INACTIVE)}>
                Inactive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(StaffStatus.TRIAL)}>
                Trial
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={loadStaff} className="flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('firstName')}>
                First Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'firstName' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('lastName')}>
                Last Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'lastName' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('email')}>
                Email
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'email' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('role')}>
                Role
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'role' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                Status
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'status' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  {searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL' 
                    ? "No staff match your filters" 
                    : "No staff found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredStaff.map((staff) => (
                <TableRow 
                  key={staff.id} 
                  className="cursor-pointer"
                  onClick={() => handleStaffClick(staff.id)}
                >
                  <TableCell className="font-medium">
                    {staff.firstName || '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {staff.lastName || '-'}
                  </TableCell>
                  <TableCell>{staff.email || '-'}</TableCell>
                  <TableCell>{staff.phoneNumber || '-'}</TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(staff.role)}>
                      {staff.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusBadgeColor(staff.status)}>
                      {staff.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="text-sm text-muted-foreground">
        {filteredStaff.length} staff displayed
      </div>

      {/* Add Staff Modal */}
      <AddStaffModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStaffAdded={handleStaffUpdated}
      />

      {/* View/Edit Staff Modal */}
      <ViewStaffModal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        staffId={selectedStaffId}
        onStaffUpdated={handleStaffUpdated}
      />
    </div>
  );
} 