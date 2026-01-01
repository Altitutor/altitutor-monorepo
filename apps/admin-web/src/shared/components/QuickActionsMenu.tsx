'use client';

import { useChatStore } from '@/features/messages/state/chatStore';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { Calendar, FileText, Zap, Megaphone } from 'lucide-react';

export function QuickActionsMenu() {
  const minimized = useChatStore(s => s.minimized);
  const { openTutorLogModal, openLogAbsenceDialog, openLogStaffAbsenceDialog, openBulkMessagingModal } = useQuickActions();

  // Hide when messages are expanded (not minimized)
  if (!minimized) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform"
            title="Quick Actions"
            aria-label="Quick Actions"
          >
            <Zap className="h-6 w-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-48">
          <DropdownMenuItem onClick={openBulkMessagingModal}>
            <Megaphone className="h-4 w-4 mr-2" />
            Make Announcement
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openTutorLogModal}>
            <FileText className="h-4 w-4 mr-2" />
            Tutor Log
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openLogAbsenceDialog}>
            <Calendar className="h-4 w-4 mr-2" />
            Log Absence
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

