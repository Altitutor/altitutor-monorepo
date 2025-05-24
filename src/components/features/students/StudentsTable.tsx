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
import { Student, StudentStatus } from '@/lib/supabase/db/types';
import { studentsApi } from '@/lib/supabase/api';
import { cn } from '@/lib/utils/index';
import { AddStudentModal } from './AddStudentModal';
import { ViewStudentModal } from './ViewStudentModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StudentsTableProps {
  onRefresh?: number;
}

export function StudentsTable({ onRefresh }: StudentsTableProps = {}) {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Student>('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Load data
  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await studentsApi.getAllStudents();
      console.log("Student data loaded:", data); // Debug log to check data structure
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students:', err);
      setError('Failed to load students. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize and refresh data
  useEffect(() => {
    loadStudents();
  }, [onRefresh]);

  // Apply filters and sorting
  useEffect(() => {
    if (!students) return;
    
    let result = [...students];
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(student => 
        (student.firstName?.toLowerCase() || '').includes(searchLower) ||
        (student.lastName?.toLowerCase() || '').includes(searchLower) ||
        (student.studentEmail?.toLowerCase() || '').includes(searchLower) ||
        (student.parentEmail?.toLowerCase() || '').includes(searchLower) ||
        (student.school?.toLowerCase() || '').includes(searchLower)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(student => student.status === statusFilter);
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
      
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      return 0;
    });
    
    setFilteredStudents(result);
  }, [students, searchTerm, statusFilter, sortField, sortDirection]);

  const handleSort = (field: keyof Student) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const getStatusBadgeColor = (status: StudentStatus) => {
    switch (status) {
      case StudentStatus.ACTIVE:
        return 'bg-green-100 text-green-800';
      case StudentStatus.INACTIVE:
        return 'bg-gray-100 text-gray-800';
      case StudentStatus.TRIAL:
        return 'bg-orange-100 text-orange-800';
      case StudentStatus.DISCONTINUED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const handleStudentClick = (id: string) => {
    setSelectedStudentId(id);
    setIsViewModalOpen(true);
  };

  const handleStudentUpdated = () => {
    loadStudents();
  };

  const handleAddStudentClick = () => {
    setIsAddModalOpen(true);
  };

  if (loading && students.length === 0) {
    return <div className="flex justify-center p-4">Loading students...</div>;
  }

  if (error && students.length === 0) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
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
                Status: {statusFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter('ALL')}>
                All Statuses
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(StudentStatus.ACTIVE)}>
                Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(StudentStatus.INACTIVE)}>
                Inactive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(StudentStatus.TRIAL)}>
                Trial
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(StudentStatus.DISCONTINUED)}>
                Discontinued
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={loadStudents} className="flex items-center">
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
              <TableHead className="cursor-pointer" onClick={() => handleSort('studentEmail')}>
                Student Email
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'studentEmail' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Parent Email</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('school')}>
                School
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'school' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('yearLevel')}>
                Year Level
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'yearLevel' ? "opacity-100" : "opacity-40"
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
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  {searchTerm || statusFilter !== 'ALL' 
                    ? "No students match your filters" 
                    : "No students found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => (
                <TableRow 
                  key={student.id} 
                  className="cursor-pointer"
                  onClick={() => handleStudentClick(student.id)}
                >
                  <TableCell className="font-medium">
                    {student.firstName || '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {student.lastName || '-'}
                  </TableCell>
                  <TableCell>{student.studentEmail || '-'}</TableCell>
                  <TableCell>{student.parentEmail || '-'}</TableCell>
                  <TableCell>{student.school || '-'}</TableCell>
                  <TableCell>{student.yearLevel || '-'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusBadgeColor(student.status)}>
                      {student.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="text-sm text-muted-foreground">
        {filteredStudents.length} students displayed
      </div>

      {/* Add Student Modal */}
      <AddStudentModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStudentAdded={handleStudentUpdated}
      />

      {/* View/Edit Student Modal */}
      <ViewStudentModal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        studentId={selectedStudentId}
        onStudentUpdated={handleStudentUpdated}
      />
    </div>
  );
} 