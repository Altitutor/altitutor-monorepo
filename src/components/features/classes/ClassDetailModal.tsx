'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Class, ClassStatus } from '@/lib/supabase/db/types';
import { useClassesStaff, useStaff } from '@/lib/hooks';
import { Pencil, Loader2 } from 'lucide-react';

interface ClassDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  classData: Class;
}

export function ClassDetailModal({ isOpen, onClose, onEdit, classData }: ClassDetailModalProps) {
  const { items: classStaffRelations, fetchByClassId, loading: staffRelationsLoading, error: staffRelationsError } = useClassesStaff();
  const { items: allStaff, fetchAll: fetchAllStaff, loading: allStaffLoading, error: allStaffError } = useStaff();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentClassData, setCurrentClassData] = useState<Class>(classData);

  useEffect(() => {
    setCurrentClassData(classData);
  }, [classData]);

  useEffect(() => {
    if (isOpen && currentClassData) {
      fetchTutors();
    }
  }, [isOpen, currentClassData]);

  const fetchTutors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First fetch all staff if they haven't been loaded yet
      if (!allStaff || allStaff.length === 0) {
        await fetchAllStaff();
      }
      
      // Then fetch the staff relations for this class
      await fetchByClassId(currentClassData.id);
    } catch (err) {
      console.error('Failed to fetch tutors:', err);
      setError('Failed to load tutors. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Set error from hooks
  useEffect(() => {
    if (staffRelationsError) {
      setError(`Failed to load tutors: ${staffRelationsError}`);
    } else if (allStaffError) {
      setError(`Failed to load staff information: ${allStaffError}`);
    } else {
      setError(null);
    }
  }, [staffRelationsError, allStaffError]);

  const getTutorNames = () => {
    if (loading || staffRelationsLoading || allStaffLoading) {
      return (
        <span className="flex items-center">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading tutors...
        </span>
      );
    }
    
    if (!classStaffRelations || !allStaff) return 'Not assigned';
    
    const tutorIds = classStaffRelations
      .filter(rel => rel.classId === currentClassData.id)
      .map(rel => rel.staffId);
    
    const tutors = allStaff.filter(staff => tutorIds.includes(staff.id));
    
    if (tutors.length === 0) return 'Not assigned';
    
    return tutors.map(tutor => `${tutor.firstName} ${tutor.lastName}`).join(', ');
  };

  const getDayOfWeek = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
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

  const handleRefresh = () => {
    fetchTutors();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-xl flex justify-between items-center">
            <span>{currentClassData.subject} Details</span>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center" 
              onClick={onEdit}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </SheetTitle>
        </SheetHeader>

        {error && (
          <div className="p-3 mb-4 rounded-md bg-red-50 text-red-800 text-sm flex justify-between">
            <div>{error}</div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh} 
              className="h-6 px-2 text-red-800"
            >
              Retry
            </Button>
          </div>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Subject</p>
                  <p>{currentClassData.subject}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge className={getStatusBadgeColor(currentClassData.status)}>
                    {currentClassData.status}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tutor(s)</p>
                  <p>{getTutorNames()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Max Capacity</p>
                  <p>{currentClassData.maxCapacity || 'Not specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Day</p>
                  <p>{getDayOfWeek(currentClassData.dayOfWeek)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Time</p>
                  <p>{formatTime(currentClassData.startTime)} - {formatTime(currentClassData.endTime)}</p>
                </div>
              </div>
              
              {currentClassData.room && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Room</p>
                  <p>{currentClassData.room}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {currentClassData.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="whitespace-pre-wrap">{currentClassData.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
} 