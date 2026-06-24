'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogPortal } from '@altitutor/ui';
import { ViewClassModal } from '@/features/classes';
import { cn } from '@/shared/utils';
import { tutorDialogContentClass } from '@/shared/lib/tutor-visual';
import { CommandPalette } from './CommandPalette';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPaletteModal({ isOpen, onClose }: CommandPaletteModalProps) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

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
    if (type === 'class') {
      setSelectedClassId(id);
      setIsClassModalOpen(true);
    }
  };

  if (!isOpen && !selectedClassId) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogPortal>
          <DialogContent
            className={cn(
              tutorDialogContentClass,
              'z-[101] flex h-[calc(100dvh-2rem)] max-h-[800px] w-full max-w-[calc(100vw-2rem)] flex-col gap-0 p-0 md:max-w-4xl [&>button]:hidden',
            )}
          >
            <CommandPalette
              isOpen={isOpen}
              onClose={onClose}
              onEntitySelected={handleEntitySelected}
            />
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {selectedClassId ? (
        <ViewClassModal
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          classId={selectedClassId}
        />
      ) : null}
    </>
  );
}
