'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ViewInvoiceModal } from '@/features/billing/components/ViewInvoiceModal';
import { ViewClassModal } from '@/features/classes/components';
import { EditDocumentDialog } from '@/features/notes/components/EditDocumentDialog';
import { EditIssueDialog } from '@/features/issues/components/EditIssueDialog';
import { EditProjectDialog } from '@/features/projects/components/EditProjectDialog';
import { EditTaskDialog } from '@/features/tasks/components/EditTaskDialog';
import { ViewStaffModal } from '@/features/staff/components/modal';
import { ViewStudentModal } from '@/features/students/components';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewSubjectModal } from '@/features/subjects/components';
import { FilePreviewModal, GenericFilePreviewModal, ViewTopicModal } from '@/features/topics/components';
import { ViewAdminShiftModal } from '@/features/admin-shifts/components';

export type EntityModalType =
  | 'student'
  | 'parent'
  | 'staff'
  | 'class'
  | 'session'
  | 'invoice'
  | 'subject'
  | 'topic'
  | 'admin-shift'
  | 'file'
  | 'file-preview'
  | 'issue'
  | 'task'
  | 'project'
  | 'note';

type EntityModalEntry = {
  key: number;
  type: EntityModalType;
  id: string;
  defaultTab?: string;
};

type OpenOptions = {
  defaultTab?: string;
};

interface EntityModalContextType {
  openEntity: (type: EntityModalType, id: string, options?: OpenOptions) => void;
  openStudent: (studentId: string) => void;
  openParent: (parentId: string, options?: OpenOptions) => void;
  openStaff: (staffId: string, options?: OpenOptions) => void;
  openClass: (classId: string) => void;
  openSession: (sessionId: string) => void;
  openInvoice: (invoiceId: string) => void;
  openSubject: (subjectId: string) => void;
  openTopic: (topicId: string) => void;
  openAdminShift: (adminShiftId: string) => void;
  openFile: (topicFileId: string) => void;
  openFilePreview: (fileId: string) => void;
  openIssue: (issueId: string) => void;
  openTask: (taskId: string) => void;
  openProject: (projectId: string) => void;
  openNote: (noteId: string) => void;
  closeAllEntityModals: () => void;
}

const EntityModalContext = createContext<EntityModalContextType | undefined>(undefined);

function getEntityTypeFromEventName(eventName: string): EntityModalType | null {
  switch (eventName) {
    case 'open-student-modal':
      return 'student';
    case 'open-parent-modal':
      return 'parent';
    case 'open-staff-modal':
      return 'staff';
    case 'open-class-modal':
      return 'class';
    case 'open-session-modal':
      return 'session';
    case 'open-invoice-modal':
      return 'invoice';
    case 'open-subject-modal':
      return 'subject';
    case 'open-topic-modal':
      return 'topic';
    case 'open-admin-shift-modal':
      return 'admin-shift';
    case 'open-file-preview':
      return 'file-preview';
    default:
      return null;
  }
}

function getEventId(event: Event): string | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail = event.detail as { id?: unknown } | undefined;
  return typeof detail?.id === 'string' && detail.id ? detail.id : null;
}

export function EntityModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const nextKeyRef = useRef(1);
  const [stack, setStack] = useState<EntityModalEntry[]>([]);

  const closeEntry = useCallback((key: number) => {
    setStack((current) => current.filter((entry) => entry.key !== key));
  }, []);

  const closeAllEntityModals = useCallback(() => {
    setStack([]);
  }, []);

  const openEntity = useCallback((type: EntityModalType, id: string, options?: OpenOptions) => {
    setStack((current) => [
      ...current,
      {
        key: nextKeyRef.current++,
        type,
        id,
        defaultTab: options?.defaultTab,
      },
    ]);
  }, []);

  const value = useMemo<EntityModalContextType>(
    () => ({
      openEntity,
      openStudent: (studentId) => openEntity('student', studentId),
      openParent: (parentId, options) => openEntity('parent', parentId, options),
      openStaff: (staffId, options) => openEntity('staff', staffId, options),
      openClass: (classId) => openEntity('class', classId),
      openSession: (sessionId) => openEntity('session', sessionId),
      openInvoice: (invoiceId) => openEntity('invoice', invoiceId),
      openSubject: (subjectId) => openEntity('subject', subjectId),
      openTopic: (topicId) => openEntity('topic', topicId),
      openAdminShift: (adminShiftId) => openEntity('admin-shift', adminShiftId),
      openFile: (topicFileId) => openEntity('file', topicFileId),
      openFilePreview: (fileId) => openEntity('file-preview', fileId),
      openIssue: (issueId) => openEntity('issue', issueId),
      openTask: (taskId) => openEntity('task', taskId),
      openProject: (projectId) => openEntity('project', projectId),
      openNote: (noteId) => openEntity('note', noteId),
      closeAllEntityModals,
    }),
    [closeAllEntityModals, openEntity]
  );

  useEffect(() => {
    const handleMentionClick = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;

      const { id, type } = (event.detail ?? {}) as { id?: unknown; type?: unknown };
      if (typeof id !== 'string' || typeof type !== 'string') return;

      if (type === 'note') {
        router.push(`/documents/${id}`);
        return;
      }

      openEntity(type as EntityModalType, id);
    };

    const eventNames = [
      'open-student-modal',
      'open-parent-modal',
      'open-staff-modal',
      'open-class-modal',
      'open-session-modal',
      'open-invoice-modal',
      'open-subject-modal',
      'open-topic-modal',
      'open-admin-shift-modal',
      'open-file-preview',
    ];

    const handleOpenEvent = (event: Event) => {
      const type = getEntityTypeFromEventName(event.type);
      const id = getEventId(event);
      if (type && id) openEntity(type, id);
    };

    window.addEventListener('mentionClick', handleMentionClick);
    for (const eventName of eventNames) {
      window.addEventListener(eventName, handleOpenEvent);
    }

    return () => {
      window.removeEventListener('mentionClick', handleMentionClick);
      for (const eventName of eventNames) {
        window.removeEventListener(eventName, handleOpenEvent);
      }
    };
  }, [openEntity, router]);

  return (
    <EntityModalContext.Provider value={value}>
      {children}
      {stack.map((entry) => {
        const onClose = () => closeEntry(entry.key);

        switch (entry.type) {
          case 'student':
            return (
              <ViewStudentModal
                key={entry.key}
                isOpen
                onClose={onClose}
                studentId={entry.id}
                onStudentUpdated={() => {}}
              />
            );
          case 'parent':
            return (
              <ViewParentModal
                key={entry.key}
                isOpen
                onClose={onClose}
                parentId={entry.id}
                onParentUpdated={() => {}}
                defaultTab={entry.defaultTab}
              />
            );
          case 'staff':
            return (
              <ViewStaffModal
                key={entry.key}
                isOpen
                staffId={entry.id}
                onClose={onClose}
                onStaffUpdated={() => {}}
                initialTab={entry.defaultTab}
              />
            );
          case 'class':
            return (
              <ViewClassModal
                key={entry.key}
                isOpen
                classId={entry.id}
                onClose={onClose}
                onClassUpdated={() => {}}
              />
            );
          case 'session':
            return <SessionModal key={entry.key} isOpen sessionId={entry.id} onClose={onClose} />;
          case 'invoice':
            return <ViewInvoiceModal key={entry.key} isOpen invoiceId={entry.id} onClose={onClose} />;
          case 'subject':
            return (
              <ViewSubjectModal
                key={entry.key}
                isOpen
                onClose={onClose}
                subjectId={entry.id}
                onSubjectUpdated={() => {}}
              />
            );
          case 'topic':
            return (
              <ViewTopicModal
                key={entry.key}
                isOpen
                onClose={onClose}
                topicId={entry.id}
                onTopicUpdated={() => {}}
              />
            );
          case 'admin-shift':
            return (
              <ViewAdminShiftModal
                key={entry.key}
                isOpen
                adminShiftId={entry.id}
                onClose={onClose}
                onAdminShiftUpdated={() => {}}
              />
            );
          case 'file':
            return <FilePreviewModal key={entry.key} isOpen onClose={onClose} topicFileId={entry.id} />;
          case 'file-preview':
            return <GenericFilePreviewModal key={entry.key} isOpen onClose={onClose} fileId={entry.id} />;
          case 'issue':
            return (
              <EditIssueDialog
                key={entry.key}
                isOpen
                onClose={onClose}
                issueId={entry.id}
                onIssueUpdated={() => {}}
              />
            );
          case 'task':
            return (
              <EditTaskDialog
                key={entry.key}
                isOpen
                onClose={onClose}
                taskId={entry.id}
                onTaskUpdated={() => {}}
              />
            );
          case 'project':
            return <EditProjectDialog key={entry.key} isOpen onClose={onClose} projectId={entry.id} />;
          case 'note':
            return <EditDocumentDialog key={entry.key} isOpen onClose={onClose} noteId={entry.id} />;
          default:
            return null;
        }
      })}
    </EntityModalContext.Provider>
  );
}

export function useEntityModals() {
  const context = useContext(EntityModalContext);
  if (!context) {
    throw new Error('useEntityModals must be used within an EntityModalProvider');
  }
  return context;
}
