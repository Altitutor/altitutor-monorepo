import { useState, useEffect } from 'react';
import { Student, Class, Subject, Staff } from "@/lib/supabase/db/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Clock, Users, MapPin } from "lucide-react";
import { classesApi } from '@/lib/supabase/api';
import { formatSubjectDisplay } from '@/lib/utils';
import { ViewClassModal } from '@/components/features/classes/modal';

interface ClassesTabProps {
  student: Student;
}

interface StudentClass {
  class: Class;
  subject?: Subject;
  staff: Staff[];
  studentCount: number;
}

export function ClassesTab({
  student
}: ClassesTabProps) {
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state for class viewing
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  useEffect(() => {
    loadStudentClasses();
  }, [student.id]);

  const loadStudentClasses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all classes with details
      const { classes: allClasses, classSubjects, classStaff, classStudents } = await classesApi.getAllClassesWithDetails();
      
      // Filter classes that include this student
      const studentClasses: StudentClass[] = [];
      
      for (const cls of allClasses) {
        // Check if student is enrolled in this class
        const enrolledStudents = classStudents[cls.id] || [];
        const isEnrolled = enrolledStudents.some(enrolledStudent => enrolledStudent.id === student.id);
        
        if (isEnrolled) {
          const subject = classSubjects[cls.id];
          const staff = classStaff[cls.id] || [];
          const studentCount = enrolledStudents.length;
          
          studentClasses.push({
            class: cls,
            subject,
            staff,
            studentCount
          });
        }
      }
      
      // Sort by day of week, then by start time
      studentClasses.sort((a, b) => {
        const dayA = a.class.dayOfWeek === 0 ? 7 : a.class.dayOfWeek;
        const dayB = b.class.dayOfWeek === 0 ? 7 : b.class.dayOfWeek;
        
        if (dayA !== dayB) {
          return dayA - dayB;
        }
        
        return a.class.startTime.localeCompare(b.class.startTime);
      });
      
      setClasses(studentClasses);
    } catch (err) {
      console.error('Error loading student classes:', err);
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

  const getSubjectDisplay = (studentClass: StudentClass): string => {
    if (studentClass.subject) {
      return formatSubjectDisplay(studentClass.subject);
    }
    return studentClass.class.level;
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
          <Button variant="outline" onClick={loadStudentClasses}>
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
        <p className="text-sm text-muted-foreground mb-4">No classes enrolled</p>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          This student is not currently enrolled in any classes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-[calc(100vh-300px)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">Enrolled Classes ({classes.length})</h3>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {classes.map((studentClass) => (
            <Card 
              key={studentClass.class.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleClassClick(studentClass.class.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {getSubjectDisplay(studentClass)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {studentClass.class.level}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {getDayOfWeek(studentClass.class.dayOfWeek)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatTime(studentClass.class.startTime)} - {formatTime(studentClass.class.endTime)}
                    </span>
                  </div>
                  
                  {studentClass.class.room && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>Room {studentClass.class.room}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{studentClass.studentCount} student{studentClass.studentCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                
                {studentClass.staff.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Staff:</p>
                    <div className="flex flex-wrap gap-1">
                      {studentClass.staff.map((staff) => (
                        <Badge key={staff.id} variant="outline" className="text-xs">
                          {staff.firstName} {staff.lastName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {studentClass.class.notes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notes:</p>
                    <p className="text-xs text-muted-foreground">{studentClass.class.notes}</p>
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
            // Refresh student classes when class is updated
            loadStudentClasses();
          }}
        />
      )}
    </div>
  );
} 