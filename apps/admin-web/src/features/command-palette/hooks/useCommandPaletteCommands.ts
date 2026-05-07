/**
 * Hook for managing commands with actions
 */

import { useMemo } from 'react';
import { commands } from '../config/commandPalette.config';
import type { CommandPaletteCommand } from '../config/commandPalette.config';

interface CommandActions {
  openTrialSession: () => void;
  openSubsidyInterview: () => void;
  openDrafting: () => void;
  openStaffInterview: () => void;
  openTutorLog: () => void;
  openLogStudentAbsence: () => void;
  openLogStaffAbsence: () => void;
  openCreateTask: () => void;
  openCreateIssue: () => void;
  openCreateProject: () => void;
  openAnnouncementsModal: () => void;
  openBookCheckIn: () => void;
}

interface UseCommandPaletteCommandsOptions {
  commandActions: CommandActions | null;
}

export function useCommandPaletteCommands({
  commandActions,
}: UseCommandPaletteCommandsOptions) {
  const commandsWithActions = useMemo<CommandPaletteCommand[]>(() => {
    if (!commandActions) {
      // If QuickActionsProvider not available, return commands with no-op actions
      return commands.map((cmd) => ({ ...cmd, action: () => {} }));
    }

    return commands.map((cmd) => {
      let action: () => void = () => {};
      switch (cmd.id) {
        case 'trial-session':
          action = commandActions.openTrialSession;
          break;
        case 'subsidy-interview':
          action = commandActions.openSubsidyInterview;
          break;
        case 'drafting':
          action = commandActions.openDrafting;
          break;
        case 'staff-interview':
          action = commandActions.openStaffInterview;
          break;
        case 'tutor-log':
          action = commandActions.openTutorLog;
          break;
        case 'log-student-absence':
          action = commandActions.openLogStudentAbsence;
          break;
        case 'log-staff-absence':
          action = commandActions.openLogStaffAbsence;
          break;
        case 'add-task':
          action = commandActions.openCreateTask;
          break;
        case 'add-issue':
          action = commandActions.openCreateIssue;
          break;
        case 'add-project':
          action = commandActions.openCreateProject;
          break;
        case 'make-announcement':
          action = commandActions.openAnnouncementsModal;
          break;
        case 'book-check-in':
          action = commandActions.openBookCheckIn;
          break;
      }
      return { ...cmd, action };
    });
  }, [commandActions]);

  return { commandsWithActions };
}
