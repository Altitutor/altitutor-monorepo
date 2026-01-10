'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Tabs, TabsList, TabsTrigger } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Calendar, FileText, Megaphone, Plus, Loader2 } from 'lucide-react';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { LogSessionModal } from '@/features/tutor-logs';
import { LogAbsenceDialog, LogStaffAbsenceDialog, TodaySessionsView } from '@/features/sessions';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { SimpleTaskCard, EditTaskDialog } from '@/features/tasks';
import { useTasks } from '@/features/tasks/api/queries';
import { AnnouncementsModal } from '@/features/messages/components/announcements/AnnouncementsModal';
import { BookSessionModal } from '@/features/bookings/components';

type ViewMode = 'calendar' | 'table';

export default function DashboardPage() {
  const { data: currentStaff } = useCurrentStaff();
  const {
    isTutorLogModalOpen,
    isLogAbsenceDialogOpen,
    isLogStaffAbsenceDialogOpen,
    isAnnouncementsModalOpen,
    isBookingModalOpen,
    bookingSessionType,
    openTutorLogModal,
    closeTutorLogModal,
    openLogAbsenceDialog,
    closeLogAbsenceDialog,
    openLogStaffAbsenceDialog,
    closeLogStaffAbsenceDialog,
    openAnnouncementsModal,
    closeAnnouncementsModal,
    openBookingModal,
    closeBookingModal,
  } = useQuickActions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);
  const [sessionsViewMode, setSessionsViewMode] = useState<ViewMode>('calendar');

  // Fetch tasks with status 'todo' or 'in_progress'
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks({
    status: ['todo', 'in_progress'],
  });

  const currentDate = new Date();
  const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = currentDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  };

  const handleCloseSessionModal = () => {
    setIsSessionModalOpen(false);
    setSelectedSessionId(null);
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsEditTaskDialogOpen(true);
  };

  const handleCloseEditTaskDialog = () => {
    setIsEditTaskDialogOpen(false);
    setSelectedTaskId(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{dayName}, {dateStr}</p>
        </div>
      </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Sessions Today</CardTitle>
            <Tabs value={sessionsViewMode} onValueChange={(v) => setSessionsViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
          <TodaySessionsView viewMode={sessionsViewMode} onOpenSession={handleSessionClick} />
          </CardContent>
        </Card>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Tasks in progress or to do</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingTasks ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">No pending tasks</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {tasks.map((task) => (
                  <SimpleTaskCard
                    key={task.id}
                    task={task}
                    onClick={() => handleTaskClick(task.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used actions</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => openBookingModal('TRIAL_SESSION')}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Trial session
              </Button>
              <Button
                onClick={() => openBookingModal('SUBSIDY_INTERVIEW')}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Subsidy interview
              </Button>
              <Button
                onClick={() => openBookingModal('DRAFTING')}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Drafting
              </Button>
              <Button
                onClick={openAnnouncementsModal}
                variant="outline"
              >
                <Megaphone className="h-4 w-4 mr-2" />
                Make Announcement
              </Button>
              <Button
                onClick={openTutorLogModal}
                variant="outline"
              >
                <FileText className="h-4 w-4 mr-2" />
                Tutor Log
              </Button>
              <Button
                onClick={openLogAbsenceDialog}
                variant="outline"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Log Student Absence
              </Button>
              <Button
                onClick={openLogStaffAbsenceDialog}
                variant="outline"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Log Staff Absence
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <SessionModal
        isOpen={isSessionModalOpen}
        sessionId={selectedSessionId}
        onClose={handleCloseSessionModal}
      />

      {/* Edit Task Dialog */}
      {selectedTaskId && (
        <EditTaskDialog
          isOpen={isEditTaskDialogOpen}
          onClose={handleCloseEditTaskDialog}
          taskId={selectedTaskId}
        />
      )}

      {/* Quick Action Modals */}
      {currentStaff?.id && (
        <>
          <LogSessionModal
            isOpen={isTutorLogModalOpen}
            onClose={closeTutorLogModal}
            currentStaffId={currentStaff.id}
            adminMode={true}
          />
          <LogAbsenceDialog
            isOpen={isLogAbsenceDialogOpen}
            onClose={closeLogAbsenceDialog}
            staffId={currentStaff.id}
          />
          <LogStaffAbsenceDialog
            isOpen={isLogStaffAbsenceDialogOpen}
            onClose={closeLogStaffAbsenceDialog}
            staffId={currentStaff.id}
          />
          <AnnouncementsModal
            isOpen={isAnnouncementsModalOpen}
            onClose={closeAnnouncementsModal}
          />
          {bookingSessionType && (
            <BookSessionModal
              isOpen={isBookingModalOpen}
              onClose={closeBookingModal}
              sessionType={bookingSessionType}
              onBookingCreated={() => {
                closeBookingModal();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}