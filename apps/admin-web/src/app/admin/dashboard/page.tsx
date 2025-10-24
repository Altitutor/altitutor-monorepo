'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { GraduationCap, CalendarDays, Users, Clock, CheckSquare, Zap, FileText } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { useQuery } from '@tanstack/react-query';
import { useClassesWithDetails } from '@/features/classes/hooks/useClassesQuery';
import { useStudentsCount } from '@/features/students/hooks/useStudentsQuery';
import { cn, formatSubjectDisplay } from '@/shared/utils/index';
import { formatTime } from '@/shared/utils/datetime';
import { getSubjectDisciplineColor, getSubjectCurriculumColor } from '@/shared/utils/enum-colors';
import { ViewClassModal } from '@/features/classes';
import { LogSessionModal } from '@/features/tutor-logs';
import { useAuth } from '@/features/auth';

interface TodayClassesProps {
  classes: Tables<'classes'>[];
  classSubjects?: Record<string, Tables<'subjects'>>;
  classStudents?: Record<string, Tables<'students'>[]>;
  classStaff?: Record<string, Tables<'staff'>[]>;
  onClassClick: (classId: string) => void;
}

function TodayClassesView({ classes, classSubjects, classStudents, classStaff, onClassClick }: TodayClassesProps) {
  const today = new Date();
  const currentDayOfWeek = today.getDay();
  
  const todayClasses = classes.filter(cls => cls.day_of_week === currentDayOfWeek);
  
  const classesByTime = todayClasses.reduce((acc, cls) => {
    const startTime = cls.start_time || '00:00';
    if (!acc[startTime]) {
      acc[startTime] = [];
    }
    acc[startTime].push(cls);
    return acc;
  }, {} as Record<string, Tables<'classes'>[]>);

  const sortedTimeSlots = Object.keys(classesByTime).sort((a, b) => a.localeCompare(b));

  const getSubjectDisplay = (classItem: Tables<'classes'>): string => {
    if (!classSubjects || !classItem.subject_id) {
      return '-';
    }
    const subject = classSubjects[classItem.id];
    if (subject) {
      return formatSubjectDisplay(subject);
    }
    return '-';
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
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatTime(timeSlot)} - {formatTime(endTime)}</span>
            </div>
            
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
                    <p className="text-sm opacity-90">{cls.level || ''}</p>
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
  const { data: classesData, isLoading: loadingClasses, refetch: refetchClasses } = useClassesWithDetails();
  const { session } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isTutorLogModalOpen, setIsTutorLogModalOpen] = useState(false);

  // Fetch current staff record to get staff ID
  const { data: currentStaff } = useQuery({
    queryKey: ['currentStaff', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const supabase = await import('@/shared/lib/supabase/client').then(m => m.getSupabaseClient());
      const { data, error } = await supabase
        .from('staff')
        .select('id, role, first_name, last_name')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const currentDate = new Date();
  const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = currentDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const { data: aggregates, isLoading: loadingAggregates } = useQuery({
    queryKey: ['dashboard', 'classAggregates'],
    queryFn: () => import('@/shared/api').then(m => m.classesApi.getAggregates()),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });
  const { data: studentsCount, isLoading: loadingStudentsCount } = useStudentsCount();

  const loading = loadingClasses || loadingAggregates || loadingStudentsCount;

  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const handleCloseClassModal = () => {
    setIsClassModalOpen(false);
    setSelectedClassId(null);
  };

  const handleClassUpdated = () => {
    refetchClasses();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{dayName}, {dateStr}</p>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                classes={classesData?.classes || []}
                classSubjects={classesData?.classSubjects || {}}
                classStudents={classesData?.classStudents || {}}
                classStaff={classesData?.classStaff || {}}
                onClassClick={handleClassClick}
              />
            )}
          </CardContent>
        </Card>

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
      
      <div className="grid gap-6 md:grid-cols-2">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used actions</CardDescription>
            </div>
            <Zap className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button
                onClick={() => setIsTutorLogModalOpen(true)}
                className="w-full"
                variant="outline"
              >
                <FileText className="h-4 w-4 mr-2" />
                Tutor Log
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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
                <p className="text-2xl font-bold">{loading ? '...' : (studentsCount ?? 0)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CalendarDays className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Class Enrollments</p>
                <p className="text-2xl font-bold">{loading ? '...' : (aggregates?.totalClassEnrollments ?? 0)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold">{loading ? '...' : (aggregates?.totalClasses ?? 0)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ViewClassModal
        isOpen={isClassModalOpen}
        classId={selectedClassId}
        onClose={handleCloseClassModal}
        onClassUpdated={handleClassUpdated}
      />

      {currentStaff?.id && (
        <LogSessionModal
          isOpen={isTutorLogModalOpen}
          onClose={() => setIsTutorLogModalOpen(false)}
          currentStaffId={currentStaff.id}
          adminMode={true}
        />
      )}
    </div>
  );
}