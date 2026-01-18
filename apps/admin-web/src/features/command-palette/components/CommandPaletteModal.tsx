'use client';

import { useEffect, useState } from 'react';
import { CommandPalette } from './CommandPalette';
import { ViewStudentModal } from '@/features/students/components';
import { ViewStaffModal } from '@/features/staff/components/modal';
import { ViewClassModal } from '@/features/classes/components';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { ViewSubjectModal } from '@/features/subjects/components';
import { ViewTopicModal } from '@/features/topics/components';

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
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);

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
    setIsStudentModalOpen(false);
    setIsStaffModalOpen(false);
    setIsClassModalOpen(false);
    setIsParentModalOpen(false);
    setIsSubjectModalOpen(false);
    setIsTopicModalOpen(false);
    
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
    }
  };

  if (!isOpen && !selectedStudentId && !selectedStaffId && !selectedClassId && !selectedParentId && !selectedSubjectId && !selectedTopicId) {
    return null;
  }

  return (
    <>
      {/* Backdrop - higher z-index to cover floating buttons (z-50) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      {/* Command Palette */}
      {isOpen && (
        <CommandPalette isOpen={isOpen} onClose={onClose} onEntitySelected={handleEntitySelected} />
      )}

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
    </>
  );
}
