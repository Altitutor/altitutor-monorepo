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
import { Calendar, FileText, Zap, Megaphone, Plus } from 'lucide-react';

export function QuickActionsMenu() {
  const minimized = useChatStore(s => s.minimized);
  const { openTutorLogModal, openLogAbsenceDialog, openLogStaffAbsenceDialog, openAnnouncementsModal, openBookingModal } = useQuickActions();

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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Plus className="h-4 w-4 mr-2" />
              Add meeting
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => openBookingModal('TRIAL_SESSION')}>
                Trial session
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openBookingModal('SUBSIDY_INTERVIEW')}>
                Subsidy interview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openBookingModal('DRAFTING')}>
                Drafting
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={openAnnouncementsModal}>
            <Megaphone className="h-4 w-4 mr-2" />
            Make Announcement
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openTutorLogModal}>
            <FileText className="h-4 w-4 mr-2" />
            Tutor Log
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openLogAbsenceDialog}>
            <Calendar className="h-4 w-4 mr-2" />
            Log Student Absence
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openLogStaffAbsenceDialog}>
            <Calendar className="h-4 w-4 mr-2" />
            Log Staff Absence
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

