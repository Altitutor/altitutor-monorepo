'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Calendar, Clock, CheckSquare, Zap, FileText } from 'lucide-react';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { LogSessionModal } from '@/features/tutor-logs';
import { LogAbsenceDialog, TodaySessionsView } from '@/features/sessions';
import { SessionModal } from '@/features/sessions/components/SessionModal';

export default function DashboardPage() {
  const { data: currentStaff } = useCurrentStaff();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isTutorLogModalOpen, setIsTutorLogModalOpen] = useState(false);
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);

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
            <div className="space-y-1">
              <CardTitle>Sessions Today</CardTitle>
            </div>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
          <TodaySessionsView onOpenSession={handleSessionClick} />
          </CardContent>
        </Card>
      
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
              <Button
                onClick={() => setIsLogAbsenceDialogOpen(true)}
                className="w-full"
                variant="outline"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Log Absence
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

      {currentStaff?.id && (
        <>
          <LogSessionModal
            isOpen={isTutorLogModalOpen}
            onClose={() => setIsTutorLogModalOpen(false)}
            currentStaffId={currentStaff.id}
            adminMode={true}
          />
          <LogAbsenceDialog
            isOpen={isLogAbsenceDialogOpen}
            onClose={() => setIsLogAbsenceDialogOpen(false)}
            staffId={currentStaff.id}
          />
        </>
      )}
    </div>
  );
}