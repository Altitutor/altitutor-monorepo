'use client';

import { useEffect, useState } from 'react';

interface UseNestedModalEventsOptions {
  isOpen: boolean;
}

interface UseNestedModalEventsReturn {
  nestedSessionId: string | null;
  nestedStaffId: string | null;
  nestedStudentId: string | null;
  setNestedSessionId: (id: string | null) => void;
  setNestedStaffId: (id: string | null) => void;
  setNestedStudentId: (id: string | null) => void;
}

interface ModalEventDetail {
  id: string;
}

/**
 * Type guard to check if an event is a CustomEvent with the expected detail structure
 */
function isModalEvent(event: Event): event is CustomEvent<ModalEventDetail> {
  return event instanceof CustomEvent && typeof event.detail === 'object' && event.detail !== null && 'id' in event.detail;
}

/**
 * Hook to handle nested modal events from SessionsTable.
 * Listens for custom events and manages nested modal state.
 * Uses capture phase and stopImmediatePropagation to prevent duplicate modals.
 */
export function useNestedModalEvents({
  isOpen,
}: UseNestedModalEventsOptions): UseNestedModalEventsReturn {
  const [nestedSessionId, setNestedSessionId] = useState<string | null>(null);
  const [nestedStaffId, setNestedStaffId] = useState<string | null>(null);
  const [nestedStudentId, setNestedStudentId] = useState<string | null>(null);

  // Listen for events from SessionsTable - only when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const onOpenSession = (e: Event) => {
      e.stopImmediatePropagation(); // Prevent other listeners from handling this event
      if (isModalEvent(e) && e.detail.id) {
        setNestedSessionId(e.detail.id);
      }
    };

    const onOpenStaff = (e: Event) => {
      e.stopImmediatePropagation(); // Prevent other listeners from handling this event
      if (isModalEvent(e) && e.detail.id) {
        setNestedStaffId(e.detail.id);
      }
    };

    const onOpenStudent = (e: Event) => {
      e.stopImmediatePropagation(); // Prevent other listeners from handling this event
      if (isModalEvent(e) && e.detail.id) {
        setNestedStudentId(e.detail.id);
      }
    };

    // Use capture phase (true) to ensure our listeners run first
    // TypeScript requires EventListener type, but we know these are CustomEvents
    window.addEventListener('open-session-modal', onOpenSession as EventListener, true);
    window.addEventListener('open-staff-modal', onOpenStaff as EventListener, true);
    window.addEventListener('open-student-modal', onOpenStudent as EventListener, true);

    return () => {
      window.removeEventListener('open-session-modal', onOpenSession as EventListener, true);
      window.removeEventListener('open-staff-modal', onOpenStaff as EventListener, true);
      window.removeEventListener('open-student-modal', onOpenStudent as EventListener, true);
    };
  }, [isOpen]);

  // Reset nested modal state when parent modal closes
  useEffect(() => {
    if (!isOpen) {
      setNestedSessionId(null);
      setNestedStaffId(null);
      setNestedStudentId(null);
    }
  }, [isOpen]);

  return {
    nestedSessionId,
    nestedStaffId,
    nestedStudentId,
    setNestedSessionId,
    setNestedStaffId,
    setNestedStudentId,
  };
}
