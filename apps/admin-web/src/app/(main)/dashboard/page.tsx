'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap, CalendarDays, Users, Clock, CheckSquare, Zap } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { classesApi } from '@/shared/api';
import { studentsApi } from '@/features/students/api';
import { cn, formatSubjectDisplay } from '@/shared/utils/index';
import { getSubjectDisciplineColor, getSubjectCurriculumColor } from '@/shared/utils/enum-colors';
import { ViewClassModal } from '@/features/classes';

interface TodayClassesProps {
  classes: Tables<'classes'>[];
  classSubjects?: Record<string, Tables<'subjects'>>;
  classStudents?: Record<string, Tables<'students'>[]>;
  classStaff?: Record<string, Tables<'staff'>[]>;
  onClassClick: (classId: string) => void;
}

function TodayClassesView({ classes, classSubjects, classStudents, classStaff, onClassClick }: TodayClassesProps) {
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Filter classes for today
  const todayClasses = classes.filter(cls => cls.day_of_week === currentDayOfWeek);
  
  // Group classes by start time
  const classesByTime = todayClasses.reduce((acc, cls) => {
    const startTime = cls.start_time || '00:00';
    if (!acc[startTime]) {
      acc[startTime] = [];
    }
    acc[startTime].push(cls);
    return acc;
  }, {} as Record<string, Tables<'classes'>[]>);

  // Sort time slots
  const sortedTimeSlots = Object.keys(classesByTime).sort((a, b) => a.localeCompare(b));

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

  const getSubjectDisplay = (classItem: Tables<'classes'>): string => {
    if (!classSubjects || !classItem.subject_id) {
      return classItem.subject;
    }
    
    const subject = classSubjects[classItem.id];
    if (subject) {
      return formatSubjectDisplay(subject);
    }
    
    return classItem.subject;
  };

  const getClassColor = (classItem: Tables<'classes'>): string => {
    if (!classSubjects || !classItem.subject_id) {
      return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600';
    }
    
    const subject = classSubjects[classItem.id];
    if (subject) {
      if (subject.discipline) {
        const disciplineColor = getSubjectDisciplineColor(subject.discipline);
        return `${disciplineColor} border-2 dark:bg-opacity-80`;
      } else if (subject.curriculum) {
        const curriculumColor = getSubjectCurriculumColor(subject.curriculum);
        return `${curriculumColor} border-2 dark:bg-opacity-80`;
      }
    }
    
    return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600';
  };

  if (sortedTimeSlots.length === 0) {
    return (
      <div className="text-center py-8">
        <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No classes scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedTimeSlots.map((timeSlot) => {
        const timeClasses = classesByTime[timeSlot];
        const endTime = timeClasses[0]?.end_time;
        
        return (
          <div key={timeSlot} className="space-y-2">
            {/* Time header */}
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatTime(timeSlot)} - {formatTime(endTime)}</span>
            </div>
            
            {/* Classes at this time */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {timeClasses.map((cls) => (
                <div
                  key={cls.id}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer hover:scale-[1.02]',
                    getClassColor(cls)
                  )}
                  onClick={() => onClassClick(cls.id)}
                >
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">
                      {getSubjectDisplay(cls)}
                    </h4>
                    <p className="text-sm opacity-90">{cls.subject}</p>
                    <div className="flex items-center justify-between text-xs opacity-75">
                      <div className="space-y-1">
                        {cls.room && <div>Room {cls.room}</div>}
                        {classStudents && classStudents[cls.id]?.length > 0 && (
                          <div>{classStudents[cls.id].length} student{classStudents[cls.id].length !== 1 ? 's' : ''}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClassEnrollments: 0,
    totalClasses: 0,
  });
  const [classesData, setClassesData] = useState<{
    classes: Tables<'classes'>[];
    classSubjects: Record<string, Tables<'subjects'>>;
    classStudents: Record<string, Tables<'students'>[]>;
    classStaff: Record<string, Tables<'staff'>[]>;
  }>({
    classes: [],
    classSubjects: {},
    classStudents: {},
    classStaff: {},
  });
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  // Get current date and day
  const currentDate = new Date();
  const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = currentDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch classes with details
        const classesResult = await classesApi.getAllClassesWithDetails();
        setClassesData(classesResult);

        // Fetch students for total count
        const students = await studentsApi.getAllStudents();
        
        // Calculate stats
        const totalClassEnrollments = Object.values(classesResult.classStudents)
          .reduce((total, students) => total + students.length, 0);
          
        setStats({
          totalStudents: students.length,
          totalClassEnrollments,
          totalClasses: classesResult.classes.length,
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const handleCloseClassModal = () => {
    setIsClassModalOpen(false);
    setSelectedClassId(null);
  };

  const handleClassUpdated = () => {
    // Refresh the classes data when a class is updated
    const fetchData = async () => {
      try {
        const classesResult = await classesApi.getAllClassesWithDetails();
        setClassesData(classesResult);
      } catch (error) {
        console.error('Error refreshing classes data:', error);
      }
    };
    fetchData();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Date */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{dayName}, {dateStr}</p>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Today's Classes */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Today's Classes</CardTitle>
              <CardDescription>Classes scheduled for {dayName}</CardDescription>
            </div>
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading classes...</p>
              </div>
            ) : (
              <TodayClassesView 
                classes={classesData.classes}
                classSubjects={classesData.classSubjects}
                classStudents={classesData.classStudents}
                classStaff={classesData.classStaff}
                onClassClick={handleClassClick}
              />
            )}
          </CardContent>
        </Card>

        {/* Sessions Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Sessions Today</CardTitle>
              <CardDescription>Planned sessions</CardDescription>
            </div>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-muted-foreground">Coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tasks and Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Your pending tasks</CardDescription>
            </div>
            <CheckSquare className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-muted-foreground">Coming soon</p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used actions</CardDescription>
            </div>
            <Zap className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-muted-foreground">Coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Panel - Moved to bottom */}
      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Key metrics and statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{loading ? '...' : stats.totalStudents}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CalendarDays className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Class Enrollments</p>
                <p className="text-2xl font-bold">{loading ? '...' : stats.totalClassEnrollments}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold">{loading ? '...' : stats.totalClasses}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Class Modal */}
      <ViewClassModal
        isOpen={isClassModalOpen}
        classId={selectedClassId}
        onClose={handleCloseClassModal}
        onClassUpdated={handleClassUpdated}
      />
    </div>
  );
} 