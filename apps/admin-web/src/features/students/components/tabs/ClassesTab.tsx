import { useState, useEffect } from 'react';
import type { Tables } from "@altitutor/shared";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Calendar, Clock, Users, MapPin, UserCog, BookOpen, Plus, Search } from "lucide-react";
import { classesApi } from '@/shared/api';
import { formatSubjectDisplay } from '@/shared/utils';
import { ViewClassModal } from '@/features/classes';
import { cn } from "@/shared/utils";
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';

interface ClassesTabProps {
  student: Tables<'students'>;
  onStudentUpdated?: () => void;
}

interface StudentClass {
  class: Tables<'classes'>;
  subject?: Tables<'subjects'>;
  staff: Tables<'staff'>[];
  studentCount: number;
}

export function ClassesTab({
  student,
  onStudentUpdated
}: ClassesTabProps) {
  const { toast } = useToast();
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [allClasses, setAllClasses] = useState<StudentClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingClasses, setEnrollingClasses] = useState<Set<string>>(new Set());
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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
      const { classes: allClassesData, classSubjects, classStaff, classStudents } = await classesApi.getAllClassesWithDetails();
      
      // Create StudentClass objects for all classes
      const allClassesWithDetails: StudentClass[] = [];
      const studentClasses: StudentClass[] = [];
      
      for (const cls of allClassesData) {
        const subject = classSubjects[cls.id];
        const staff = classStaff[cls.id] || [];
        const enrolledStudents = classStudents[cls.id] || [];
        const studentCount = enrolledStudents.length;
        const isEnrolled = enrolledStudents.some(enrolledStudent => enrolledStudent.id === student.id);
        
        const classWithDetails = {
          class: cls,
          subject,
          staff,
          studentCount
        };
        
        allClassesWithDetails.push(classWithDetails);
        
        if (isEnrolled) {
          studentClasses.push(classWithDetails);
        }
      }
      
      // Sort by day of week, then by start time
      const sortClasses = (classes: StudentClass[]) => {
        return classes.sort((a, b) => {
          const dayA = a.class.day_of_week === 0 ? 7 : a.class.day_of_week;
          const dayB = b.class.day_of_week === 0 ? 7 : b.class.day_of_week;
          
          if (dayA !== dayB) {
            return dayA - dayB;
          }
          
          return a.class.start_time.localeCompare(b.class.start_time);
        });
      };
      
      setClasses(sortClasses([...studentClasses]));
      setAllClasses(sortClasses([...allClassesWithDetails]));
    } catch (err) {
      console.error('Error loading student classes:', err);
      setError('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  // Handle class enrollment
  const handleEnrollClass = async (classId: string) => {
    setEnrollingClasses(prev => new Set(prev).add(classId));
    setIsAddPopoverOpen(false); // Close the popover immediately for better UX
    
    try {
      await classesApi.enrollStudent(classId, student.id);
      await loadStudentClasses(); // Reload classes
      onStudentUpdated?.(); // Notify parent of changes
      
      toast({
        title: "Success",
        description: "Student enrolled in class successfully.",
      });
    } catch (error) {
      console.error('Failed to enroll in class:', error);
      toast({
        title: "Enrollment failed",
        description: "There was an error enrolling the student in the class. Please try again.",
        variant: "destructive",
      });
    } finally {
      setEnrollingClasses(prev => {
        const newSet = new Set(prev);
        newSet.delete(classId);
        return newSet;
      });
    }
  };

  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  // Get available classes for enrollment (not currently enrolled)
  const availableClasses = allClasses.filter(classData => 
    !classes.some(studentClass => studentClass.class.id === classData.class.id)
  );

  // Filter available classes based on search query
  const filteredAvailableClasses = availableClasses.filter(classData => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const subject = classData.subject ? formatSubjectDisplay(classData.subject) : '-';
    const level = classData.class.level || '';
    const day = getDayOfWeek(classData.class.day_of_week);
    const time = `${formatTime(classData.class.start_time)} - ${formatTime(classData.class.end_time)}`;
    
    return (
      subject.toLowerCase().includes(query) ||
      level.toLowerCase().includes(query) ||
      day.toLowerCase().includes(query) ||
      time.toLowerCase().includes(query)
    );
  });

  

  const getSubjectDisplay = (studentClass: StudentClass): string => {
    if (studentClass.subject) {
      return formatSubjectDisplay(studentClass.subject);
    }
    return '-';
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

  if (classes.length === 0 && enrollingClasses.size === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-4">No classes enrolled</p>
        <p className="text-xs text-muted-foreground text-center max-w-sm mb-4">
          This student is not currently enrolled in any classes.
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Enroll in a class
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[400px]" align="center">
            <div className="p-3">
              <Input
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {filteredAvailableClasses.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {searchQuery ? 'No classes match your search' : 'No available classes found'}
                    </div>
                  ) : (
                    filteredAvailableClasses.map(classData => (
                      <Button
                        key={classData.class.id}
                        variant="ghost"
                        className="w-full justify-start h-auto p-3 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleEnrollClass(classData.class.id)}
                        disabled={enrollingClasses.has(classData.class.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col items-start">
                            <div className="font-medium">
                              {getSubjectDisplay(classData)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getDayOfWeek(classData.class.day_of_week)} • {formatTime(classData.class.start_time)} - {formatTime(classData.class.end_time)}
                            </div>
                          </div>
                          {enrollingClasses.has(classData.class.id) && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex-1 h-[calc(100vh-300px)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">Enrolled Classes ({classes.length})</h3>
          
          {/* Show currently enrolling classes */}
          {enrollingClasses.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Enrolling in {enrollingClasses.size} class{enrollingClasses.size > 1 ? 'es' : ''}...</span>
            </div>
          )}
        </div>
        
        <Popover open={isAddPopoverOpen} onOpenChange={setIsAddPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Add Class</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[400px]" align="end">
            <div className="p-3">
              <Input
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {filteredAvailableClasses.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {searchQuery ? 'No classes match your search' : 'No available classes found'}
                    </div>
                  ) : (
                    filteredAvailableClasses.map(classData => (
                      <Button
                        key={classData.class.id}
                        variant="ghost"
                        className="w-full justify-start h-auto p-3 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleEnrollClass(classData.class.id)}
                        disabled={enrollingClasses.has(classData.class.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col items-start">
                            <div className="font-medium">
                              {getSubjectDisplay(classData)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getDayOfWeek(classData.class.day_of_week)} • {formatTime(classData.class.start_time)} - {formatTime(classData.class.end_time)}
                            </div>
                          </div>
                          {enrollingClasses.has(classData.class.id) && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-3">
          {/* Show currently enrolling classes at the top */}
          {Array.from(enrollingClasses).map(classId => {
            const classData = allClasses.find(c => c.class.id === classId);
            if (!classData) return null;
            
            return (
              <Card 
                key={`enrolling-${classData.class.id}`}
                className="border-dashed bg-muted/50"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold text-muted-foreground">
                        {getSubjectDisplay(classData)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {classData.class.level}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs text-muted-foreground">Enrolling...</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {formatTime(classData.class.start_time)} - {formatTime(classData.class.end_time)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{getDayOfWeek(classData.class.day_of_week)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {/* Show enrolled classes */}
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
                    {getDayOfWeek(studentClass.class.day_of_week)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatTime(studentClass.class.start_time)} - {formatTime(studentClass.class.end_time)}
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
                          {staff.first_name} {staff.last_name}
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