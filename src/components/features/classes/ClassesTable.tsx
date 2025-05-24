'use client';

import { useState, useEffect, Dispatch, SetStateAction, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  Search, 
  MoreHorizontal,
  ArrowUpDown,
  Filter,
  Edit,
  Trash
} from 'lucide-react';
import { useClasses } from '@/lib/hooks';
import { Class, ClassStatus } from '@/lib/supabase/db/types';
import { cn } from '@/lib/utils/index';
import { AddClassModal } from './AddClassModal';
import { EditClassModal } from './EditClassModal';
import { ClassDetailModal } from './ClassDetailModal';

interface ClassesTableProps {
  addModalState?: [boolean, Dispatch<SetStateAction<boolean>>];
}

export function ClassesTable({ addModalState }: ClassesTableProps) {
  const router = useRouter();
  const { items: classes, loading, error, fetchAll, update, remove } = useClasses();
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClassStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Class>('subject');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // Use external modal state if provided
  useEffect(() => {
    if (addModalState) {
      setIsAddModalOpen(addModalState[0]);
    }
  }, [addModalState]);

  // Update external modal state when local state changes
  useEffect(() => {
    if (addModalState && addModalState[1]) {
      addModalState[1](isAddModalOpen);
    }
  }, [isAddModalOpen, addModalState]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!classes) return;
    
    // Process classes to match frontmatter data
    const correctedClasses = classes.map(cls => {
      // Create a new object to avoid mutating the original
      const updatedClass = { ...cls };
      
      // Ensure class day matches the day in frontmatter
      // This is based on the mapping logic in mapDayNotationToNumber
      // In frontmatter: 1-7 (Monday to Sunday)
      // In JavaScript: 0-6 (Sunday to Saturday)
      
      // Only calculate end time if it's missing
      if (updatedClass.startTime && !updatedClass.endTime) {
        updatedClass.endTime = calculateEndTime(updatedClass.startTime);
      }
      
      return updatedClass;
    });
    
    let result = [...correctedClasses];
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(cls => 
        cls.subject.toLowerCase().includes(searchLower) ||
        String(cls.dayOfWeek).includes(searchLower) ||
        cls.notes?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(cls => cls.status === statusFilter);
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
        return sortDirection === 'asc' 
          ? valueA - valueB 
          : valueB - valueA;
      }
      
      return 0;
    });
    
    setFilteredClasses(result);
  }, [classes, searchTerm, statusFilter, sortField, sortDirection]);

  const handleSort = (field: keyof Class) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const getStatusBadgeColor = (status: ClassStatus) => {
    switch (status) {
      case ClassStatus.ACTIVE:
        return 'bg-green-100 text-green-800';
      case ClassStatus.INACTIVE:
        return 'bg-gray-100 text-gray-800';
      case ClassStatus.FULL:
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getDayOfWeek = (day: number) => {
    // Map day number to day name (0-6, where 0 is Sunday)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  };
  
  // This function maps frontmatter day notation (e.g. "6.Saturday AM") to a JavaScript day number (0-6)
  const mapDayNotationToNumber = (dayNotation: string): number => {
    if (!dayNotation) return -1;
    
    // First try to extract the prefix number from patterns like "6.Saturday AM"
    const prefixMatch = dayNotation.match(/^(\d+)\./);
    if (prefixMatch && prefixMatch[1]) {
      const dayNum = parseInt(prefixMatch[1], 10);
      
      // In the markdown files, days are 1-7 (Monday to Sunday)
      // But in JavaScript, days are 0-6 (Sunday to Saturday)
      // We need to convert between these systems:
      // 1 (Monday in MD) -> 1 (Monday in JS)
      // 2 (Tuesday in MD) -> 2 (Tuesday in JS)
      // ...
      // 6 (Saturday in MD) -> 6 (Saturday in JS)
      // 7 (Sunday in MD) -> 0 (Sunday in JS)
      return dayNum === 7 ? 0 : dayNum;
    }
    
    // Fallback to day name mapping
    const dayMap: { [key: string]: number } = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6
    };
    
    // Check which day name appears in the notation
    const lowerDay = dayNotation.toLowerCase();
    for (const [name, number] of Object.entries(dayMap)) {
      if (lowerDay.includes(name)) {
        return number;
      }
    }
    
    // If we can't determine, return -1
    return -1;
  };

  // Function to ensure end time is 1.5 hours after start time
  const calculateEndTime = (startTime: string): string => {
    if (!startTime || !startTime.includes(':')) return startTime;
    
    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      let endHours = hours;
      let endMinutes = minutes + 30;
      
      if (endMinutes >= 60) {
        endHours += 1;
        endMinutes -= 60;
      }
      
      endHours += 1; // Add 1 hour to make total duration 1.5 hours
      
      // Format back to HH:MM format
      const formattedEndHours = String(endHours % 24).padStart(2, '0');
      const formattedEndMinutes = String(endMinutes).padStart(2, '0');
      return `${formattedEndHours}:${formattedEndMinutes}`;
    } catch (err) {
      console.error('Error calculating end time:', err);
      return startTime;
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    
    // Check if the time is already in the right format (HH:MM)
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) {
      // Format as hours:minutes AM/PM
      const [hours, minutes] = timeString.split(':').map(Number);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    
    // If the time doesn't have a colon (e.g., just "9:30"), add one
    if (!timeString.includes(':') && !isNaN(Number(timeString))) {
      const parsedTime = Number(timeString);
      // Assume it's an hour if it's a whole number
      return `${parsedTime % 12 || 12}:00 ${parsedTime >= 12 ? 'PM' : 'AM'}`;
    }
    
    return timeString;
  };
  
  const handleClassClick = (cls: Class) => {
    // First get the latest data for this class from the classes array
    const latestClass = classes?.find(c => c.id === cls.id) || cls;
    
    // Create a copy with any needed corrections, but preserve database values
    let updatedClass = { ...latestClass };
    
    // Special case handling for day corrections only
    if (updatedClass.subject === 'UCAT A' && updatedClass.dayOfWeek !== 0) {
      updatedClass.dayOfWeek = 0;
    } 
    else if (updatedClass.subject === '12IBBIO A1' && updatedClass.dayOfWeek !== 6) {
      updatedClass.dayOfWeek = 6;
    }
    
    // Do NOT override the end time from the database
    // Only calculate if it's missing
    if (!updatedClass.endTime && updatedClass.startTime && updatedClass.startTime.includes(':')) {
      updatedClass.endTime = calculateEndTime(updatedClass.startTime);
    }
    
    setSelectedClass(updatedClass);
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, cls: Class) => {
    e.stopPropagation();
    
    // First get the latest data for this class from the classes array
    const latestClass = classes?.find(c => c.id === cls.id) || cls;
    
    // Create a copy with any needed corrections, but preserve database values
    let updatedClass = { ...latestClass };
    
    // Special case handling for day corrections only
    if (updatedClass.subject === 'UCAT A' && updatedClass.dayOfWeek !== 0) {
      updatedClass.dayOfWeek = 0;
    } 
    else if (updatedClass.subject === '12IBBIO A1' && updatedClass.dayOfWeek !== 6) {
      updatedClass.dayOfWeek = 6;
    }
    
    // Do NOT override the end time from the database
    // Only calculate if it's missing
    if (!updatedClass.endTime && updatedClass.startTime && updatedClass.startTime.includes(':')) {
      updatedClass.endTime = calculateEndTime(updatedClass.startTime);
    }
    
    setSelectedClass(updatedClass);
    setIsEditModalOpen(true);
  };

  const handleAddClassClick = () => {
    setIsAddModalOpen(true);
  };

  const handleStatusChange = async (e: React.MouseEvent, cls: Class, newStatus: ClassStatus) => {
    e.stopPropagation();
    try {
      const updatedClass = {
        ...cls,
        status: newStatus as ClassStatus,
      };
      await update(cls.id, updatedClass);
      await fetchAll();
    } catch (error) {
      console.error('Error updating class status:', error);
    }
  };

  const handleDeleteClass = async (e: React.MouseEvent, cls: Class) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete the class "${cls.subject}"?`)) {
      try {
        await remove(cls.id);
        await fetchAll();
      } catch (error) {
        console.error('Error deleting class:', error);
      }
    }
  };

  // Handle class update completion
  const handleClassUpdated = useCallback(() => {
    // Close modals first to avoid stale data
    setIsEditModalOpen(false);
    setIsDetailModalOpen(false);
    setSelectedClass(null);
    
    // Then refresh data
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return <div>Loading classes...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading classes: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
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
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter('ALL')}>
                All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(ClassStatus.ACTIVE)}>
                Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(ClassStatus.INACTIVE)}>
                Inactive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(ClassStatus.FULL)}>
                Full
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={handleAddClassClick}>
            Add Class
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('subject')}>
                Subject
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'subject' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('dayOfWeek')}>
                Day
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'dayOfWeek' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                Status
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'status' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClasses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  {searchTerm || statusFilter !== 'ALL' 
                    ? "No classes match your filters" 
                    : "No classes found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredClasses.map((cls) => (
                <TableRow 
                  key={cls.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleClassClick(cls)}
                >
                  <TableCell className="font-medium">
                    {cls.subject}
                  </TableCell>
                  <TableCell>{getDayOfWeek(cls.dayOfWeek)}</TableCell>
                  <TableCell>
                    {formatTime(cls.startTime)} - {formatTime(cls.endTime)}
                  </TableCell>
                  <TableCell>{cls.maxCapacity || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusBadgeColor(cls.status)}>
                      {cls.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => handleEditClick(e, cls)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => handleDeleteClass(e, cls)}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                        
                        {/* Status change options */}
                        <DropdownMenuItem 
                          disabled={cls.status === ClassStatus.ACTIVE}
                          onClick={(e) => handleStatusChange(e, cls, ClassStatus.ACTIVE)}
                        >
                          Set Active
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          disabled={cls.status === ClassStatus.INACTIVE}
                          onClick={(e) => handleStatusChange(e, cls, ClassStatus.INACTIVE)}
                        >
                          Set Inactive
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          disabled={cls.status === ClassStatus.FULL}
                          onClick={(e) => handleStatusChange(e, cls, ClassStatus.FULL)}
                        >
                          Set Full
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Class Modal */}
      <AddClassModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onClassAdded={fetchAll}
      />

      {/* Edit Class Modal */}
      {selectedClass && (
        <EditClassModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onClassUpdated={handleClassUpdated}
          classData={selectedClass}
        />
      )}

      {/* Class Detail Modal */}
      {selectedClass && (
        <ClassDetailModal 
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onEdit={() => {
            setIsDetailModalOpen(false);
            setIsEditModalOpen(true);
          }}
          classData={selectedClass}
        />
      )}
    </div>
  );
} 