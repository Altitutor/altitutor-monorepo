'use client';

import { useChatStore } from '@/features/messages/state/chatStore';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@altitutor/ui';
import { Zap, Plus } from 'lucide-react';
import { getBookingActions, getNonBookingActions } from '@/shared/constants/quickActions';

export function QuickActionsMenu() {
  const minimized = useChatStore(s => s.minimized);
  const { openTutorLogModal, openLogAbsenceDialog, openLogStaffAbsenceDialog, openAnnouncementsModal, openBookingModal, openCreateTaskDialog } = useQuickActions();
  
  const bookingActions = getBookingActions();
  const nonBookingActions = getNonBookingActions();

  // Hide when messages are expanded (not minimized)
  if (!minimized) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-16 h-16 rounded-full bg-accent text-accent-foreground dark:text-gray-900 flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform"
            title="Quick Actions"
            aria-label="Quick Actions"
          >
            <Zap className="h-6 w-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-48">
          {bookingActions.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Plus className="h-4 w-4 mr-2" />
                Add meeting
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {bookingActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <DropdownMenuItem
                      key={action.id}
                      onClick={() => action.bookingSessionType && openBookingModal(action.bookingSessionType)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {action.title}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {nonBookingActions.map((action) => {
            const Icon = action.icon;
            const handleClick = () => {
              if (action.actionType === 'create-task') {
                openCreateTaskDialog();
              } else if (action.actionType === 'announcement') {
                openAnnouncementsModal();
              } else if (action.actionType === 'tutor-log') {
                openTutorLogModal();
              } else if (action.actionType === 'log-student-absence') {
                openLogAbsenceDialog();
              } else if (action.actionType === 'log-staff-absence') {
                openLogStaffAbsenceDialog();
              }
            };

            return (
              <DropdownMenuItem key={action.id} onClick={handleClick}>
                <Icon className="h-4 w-4 mr-2" />
                {action.title}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

