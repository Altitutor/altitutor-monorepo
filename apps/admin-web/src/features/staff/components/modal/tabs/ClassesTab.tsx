import { useState, useEffect } from 'react';
import type { Tables } from "@altitutor/shared";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Clock, Users, MapPin } from "lucide-react";
import { classesApi } from '@/shared/api';
import { formatSubjectDisplay } from '@/shared/utils';
import { ViewClassModal } from '@/features/classes';

interface ClassesTabProps {
  staff: Tables<'staff'>;
}

interface StaffClass {
  class: Tables<'classes'>;
  subject?: Tables<'subjects'>;
  students: Tables<'students'>[];
  studentCount: number;
}

export function ClassesTab({
  staff
}: ClassesTabProps) {
  const [classes, setClasses] = useState<StaffClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state for class viewing
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  useEffect(() => {
    loadStaffClasses();
  }, [staff.id]);

  const loadStaffClasses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all classes with details
      const { classes: allClasses, classSubjects, classStudents, classStaff } = await classesApi.getAllClassesWithDetails();
      
      // Filter classes that include this staff member
      const staffClasses: StaffClass[] = [];
      
      for (const cls of allClasses) {
        // Check if staff is assigned to this class
        const assignedStaff = classStaff[cls.id] || [];
        const isAssigned = assignedStaff.some(assignedStaffMember => assignedStaffMember.id === staff.id);
        
        if (isAssigned) {
          const subject = classSubjects[cls.id];
          const students = classStudents[cls.id] || [];
          const studentCount = students.length;
          
          staffClasses.push({
            class: cls,
            subject,
            students,
            studentCount
          });
        }
      }
      
      // Sort by day of week, then by start time
      staffClasses.sort((a, b) => {
        const dayA = a.class.day_of_week === 0 ? 7 : a.class.day_of_week;
        const dayB = b.class.day_of_week === 0 ? 7 : b.class.day_of_week;
        
        if (dayA !== dayB) {
          return dayA - dayB;
        }
        
        return a.class.start_time.localeCompare(b.class.start_time);
      });
      
      setClasses(staffClasses);
    } catch (err) {
      console.error('Error loading staff classes:', err);
      setError('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const getDayOfWeek = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    
    return timeString;
  };

  const getSubjectDisplay = (staffClass: StaffClass): string => {
    if (staffClass.subject) {
      return formatSubjectDisplay(staffClass.subject);
    }
    return staffClass.class.subject;
  };

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <Button variant="outline" onClick={loadStaffClasses}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-4">No classes assigned</p>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          This staff member is not currently assigned to any classes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-[calc(100vh-300px)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">Assigned Classes ({classes.length})</h3>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {classes.map((staffClass) => (
            <Card 
              key={staffClass.class.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleClassClick(staffClass.class.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {getSubjectDisplay(staffClass)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {staffClass.class.subject}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {getDayOfWeek(staffClass.class.day_of_week)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatTime(staffClass.class.start_time)} - {formatTime(staffClass.class.end_time)}
                    </span>
                  </div>
                  
                  {staffClass.class.room && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>Room {staffClass.class.room}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{staffClass.studentCount} student{staffClass.studentCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                
                {staffClass.students.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Students:</p>
                    <div className="flex flex-wrap gap-1">
                      {staffClass.students.slice(0, 3).map((student) => (
                        <Badge key={student.id} variant="outline" className="text-xs">
                          {student.first_name} {student.last_name}
                        </Badge>
                      ))}
                      {staffClass.students.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{staffClass.students.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                
                {staffClass.class.notes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notes:</p>
                    <p className="text-xs text-muted-foreground">{staffClass.class.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
      
      {/* Class Modal */}
      {selectedClassId && (
        <ViewClassModal
          classId={selectedClassId}
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          onClassUpdated={() => {
            // Refresh staff classes when class is updated
            loadStaffClasses();
          }}
        />
      )}
    </div>
  );
} 