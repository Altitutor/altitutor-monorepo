'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogPortal } from '@altitutor/ui';
import { CommandPalette } from './CommandPalette';
import { ViewStudentModal } from '@/features/students/components';
import { ViewStaffModal } from '@/features/staff/components/modal';
import { ViewClassModal } from '@/features/classes/components';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { ViewSubjectModal } from '@/features/subjects/components';
import { ViewTopicModal } from '@/features/topics/components';
import { FilePreviewModal } from '@/features/topics/components';
import { EditIssueDialog } from '@/features/issues/components/EditIssueDialog';
import { EditTaskDialog } from '@/features/tasks/components/EditTaskDialog';
import { EditProjectDialog } from '@/features/projects/components/EditProjectDialog';
import { EditDocumentDialog } from '@/features/notes/components/EditDocumentDialog';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CommandPaletteModal - Wrapper component with backdrop
 * Provides the darkened background overlay for the Raycast-like search experience
 */
export function CommandPaletteModal({ isOpen, onClose }: CommandPaletteModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedTopicFileId, setSelectedTopicFileId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isFilePreviewModalOpen, setIsFilePreviewModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleEntitySelected = (type: string, id: string) => {
    // Reset all states first
    setSelectedStudentId(null);
    setSelectedStaffId(null);
    setSelectedClassId(null);
    setSelectedParentId(null);
    setSelectedSubjectId(null);
    setSelectedTopicId(null);
    setSelectedTopicFileId(null);
    setSelectedIssueId(null);
    setSelectedTaskId(null);
    setSelectedProjectId(null);
    setSelectedNoteId(null);
    setIsStudentModalOpen(false);
    setIsStaffModalOpen(false);
    setIsClassModalOpen(false);
    setIsParentModalOpen(false);
    setIsSubjectModalOpen(false);
    setIsTopicModalOpen(false);
    setIsFilePreviewModalOpen(false);
    setIsIssueModalOpen(false);
    setIsTaskModalOpen(false);
    setIsProjectModalOpen(false);
    setIsNoteModalOpen(false);

    // Set the appropriate state based on entity type
    if (type === 'student') {
      setSelectedStudentId(id);
      setIsStudentModalOpen(true);
    } else if (type === 'staff') {
      setSelectedStaffId(id);
      setIsStaffModalOpen(true);
    } else if (type === 'class') {
      setSelectedClassId(id);
      setIsClassModalOpen(true);
    } else if (type === 'parent') {
      setSelectedParentId(id);
      setIsParentModalOpen(true);
    } else if (type === 'subject') {
      setSelectedSubjectId(id);
      setIsSubjectModalOpen(true);
    } else if (type === 'topic') {
      setSelectedTopicId(id);
      setIsTopicModalOpen(true);
    } else if (type === 'file') {
      // For files, id is the topics_file_id
      setSelectedTopicFileId(id);
      setIsFilePreviewModalOpen(true);
    } else if (type === 'issue') {
      setSelectedIssueId(id);
      setIsIssueModalOpen(true);
    } else if (type === 'task') {
      setSelectedTaskId(id);
      setIsTaskModalOpen(true);
    } else if (type === 'project') {
      setSelectedProjectId(id);
      setIsProjectModalOpen(true);
    } else if (type === 'note') {
      setSelectedNoteId(id);
      setIsNoteModalOpen(true);
    }
  };

  if (!isOpen && !selectedStudentId && !selectedStaffId && !selectedClassId && !selectedParentId && !selectedSubjectId && !selectedTopicId && !selectedTopicFileId && !selectedIssueId && !selectedTaskId && !selectedProjectId && !selectedNoteId) {
    return null;
  }

  return (
    <>
      {/* Use Radix Dialog so focus is trapped in the palette when open (works even over another dialog) */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogPortal>
          <DialogContent
            className="z-[101] w-full max-w-[calc(100vw-2rem)] md:max-w-4xl h-[calc(100vh-2rem)] max-h-[800px] p-0 gap-0 border rounded-lg shadow-xl bg-popover [&>button]:hidden flex flex-col"
          >
            <CommandPalette isOpen={isOpen} onClose={onClose} onEntitySelected={handleEntitySelected} />
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Modals - rendered outside CommandPalette so they persist after palette closes */}
      {selectedStudentId && (
        <ViewStudentModal
          isOpen={isStudentModalOpen}
          onClose={() => {
            setIsStudentModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onStudentUpdated={() => {}}
        />
      )}

      {selectedStaffId && (
        <ViewStaffModal
          isOpen={isStaffModalOpen}
          onClose={() => {
            setIsStaffModalOpen(false);
            setSelectedStaffId(null);
          }}
          staffId={selectedStaffId}
          onStaffUpdated={() => {}}
        />
      )}

      {selectedClassId && (
        <ViewClassModal
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          classId={selectedClassId}
          onClassUpdated={() => {}}
        />
      )}

      {selectedParentId && (
        <ViewParentModal
          isOpen={isParentModalOpen}
          onClose={() => {
            setIsParentModalOpen(false);
            setSelectedParentId(null);
          }}
          parentId={selectedParentId}
          onParentUpdated={() => {}}
        />
      )}

      {selectedSubjectId && (
        <ViewSubjectModal
          isOpen={isSubjectModalOpen}
          onClose={() => {
            setIsSubjectModalOpen(false);
            setSelectedSubjectId(null);
          }}
          subjectId={selectedSubjectId}
          onSubjectUpdated={() => {}}
        />
      )}

      {selectedTopicId && (
        <ViewTopicModal
          isOpen={isTopicModalOpen}
          onClose={() => {
            setIsTopicModalOpen(false);
            setSelectedTopicId(null);
          }}
          topicId={selectedTopicId}
          onTopicUpdated={() => {}}
        />
      )}

      {selectedTopicFileId && (
        <FilePreviewModal
          isOpen={isFilePreviewModalOpen}
          onClose={() => {
            setIsFilePreviewModalOpen(false);
            setSelectedTopicFileId(null);
          }}
          topicFileId={selectedTopicFileId}
        />
      )}

      {selectedIssueId && (
        <EditIssueDialog
          isOpen={isIssueModalOpen}
          onClose={() => {
            setIsIssueModalOpen(false);
            setSelectedIssueId(null);
          }}
          issueId={selectedIssueId}
          onIssueUpdated={() => {}}
        />
      )}

      {selectedTaskId && (
        <EditTaskDialog
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTaskId(null);
          }}
          taskId={selectedTaskId}
          onTaskUpdated={() => {}}
        />
      )}

      {selectedProjectId && (
        <EditProjectDialog
          isOpen={isProjectModalOpen}
          onClose={() => {
            setIsProjectModalOpen(false);
            setSelectedProjectId(null);
          }}
          projectId={selectedProjectId}
        />
      )}

      {selectedNoteId && (
        <EditDocumentDialog
          isOpen={isNoteModalOpen}
          onClose={() => {
            setIsNoteModalOpen(false);
            setSelectedNoteId(null);
          }}
          noteId={selectedNoteId}
        />
      )}
    </>
  );
}
