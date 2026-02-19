'use client';

import { useEffect, useState } from 'react';
import { ViewStudentModal } from '@/features/students/components';
import { ViewStaffModal } from '@/features/staff/components/modal';
import { ViewClassModal } from '@/features/classes/components';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { ViewSubjectModal } from '@/features/subjects/components';
import { ViewTopicModal } from '@/features/topics/components';
import { FilePreviewModal } from '@/features/topics/components';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewInvoiceModal } from '@/features/billing/components/ViewInvoiceModal';
import { EditIssueDialog } from '@/features/issues/components/EditIssueDialog';
import { EditTaskDialog } from '@/features/tasks/components/EditTaskDialog';

/**
 * MentionModalProvider handles opening entity modals when a mention is clicked 
 * in any RichTextEditor across the application.
 */
export function MentionModalProvider({ children }: { children: React.ReactNode }) {
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string } | null>(null);

  useEffect(() => {
    const handleMentionClick = (event: any) => {
      const { id, type } = event.detail;
      if (id && type) {
        setSelectedEntity({ id, type });
      }
    };

    window.addEventListener('mentionClick', handleMentionClick);
    return () => window.removeEventListener('mentionClick', handleMentionClick);
  }, []);

  const closeModals = () => setSelectedEntity(null);

  return (
    <>
      {children}

      {selectedEntity?.type === 'student' && (
        <ViewStudentModal
          isOpen={!!selectedEntity}
          onClose={closeModals}
          studentId={selectedEntity.id}
          onStudentUpdated={() => {}}
        />
      )}

      {selectedEntity?.type === 'staff' && (
        <ViewStaffModal
          isOpen={!!selectedEntity}
          onClose={closeModals}
          staffId={selectedEntity.id}
          onStaffUpdated={() => {}}
        />
      )}

      {selectedEntity?.type === 'class' && (
        <ViewClassModal
          isOpen={!!selectedEntity}
          onClose={closeModals}
          classId={selectedEntity.id}
          onClassUpdated={() => {}}
        />
      )}

      {selectedEntity?.type === 'parent' && (
        <ViewParentModal
          isOpen={!!selectedEntity}
          onClose={closeModals}
          parentId={selectedEntity.id}
          onParentUpdated={() => {}}
        />
      )}

      {selectedEntity?.type === 'subject' && (
        <ViewSubjectModal
          isOpen={!!selectedEntity}
          onClose={closeModals}
          subjectId={selectedEntity.id}
          onSubjectUpdated={() => {}}
        />
      )}

      {selectedEntity?.type === 'topic' && (
        <ViewTopicModal
          isOpen={!!selectedEntity}
          onClose={closeModals}
          topicId={selectedEntity.id}
          onTopicUpdated={() => {}}
        />
      )}

      {selectedEntity?.type === 'session' && (
        <SessionModal
          isOpen={!!selectedEntity}
          onClose={closeModals}
          sessionId={selectedEntity.id}
        />
      )}

      {selectedEntity?.type === 'file' && (
        <FilePreviewModal
          isOpen={!!selectedEntity}
          onClose={closeModals}
          topicFileId={selectedEntity.id}
        />
      )}

      {selectedEntity?.type === 'invoice' && (
        <ViewInvoiceModal
          isOpen={!!selectedEntity}
          onClose={closeModals}
          invoiceId={selectedEntity.id}
        />
      )}

      {selectedEntity?.type === 'issue' && (
        <EditIssueDialog
          isOpen={!!selectedEntity}
          onClose={closeModals}
          issueId={selectedEntity.id}
          onIssueUpdated={() => {}}
        />
      )}

      {selectedEntity?.type === 'task' && (
        <EditTaskDialog
          isOpen={!!selectedEntity}
          onClose={closeModals}
          taskId={selectedEntity.id}
          onTaskUpdated={() => {}}
        />
      )}
    </>
  );
}
