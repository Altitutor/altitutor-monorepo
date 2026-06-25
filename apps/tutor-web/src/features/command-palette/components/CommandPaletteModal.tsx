'use client';

import { useEffect, useRef, useState, type TouchEvent } from 'react';
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
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      dragStartYRef.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (touch.clientY > rect.top + 72) {
      dragStartYRef.current = null;
      return;
    }

    dragStartYRef.current = touch.clientY;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (dragStartYRef.current == null) return;

    const nextOffset = Math.max(0, (event.touches[0]?.clientY ?? dragStartYRef.current) - dragStartYRef.current);
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
    if (nextOffset > 0) event.preventDefault();
  };

  const handleTouchEnd = () => {
    if (dragOffsetRef.current > 96) {
      onClose();
    }
    dragStartYRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

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
            mobilePresentation="bottom-sheet"
            className={cn(
              tutorDialogContentClass,
              'z-[101] flex h-[calc(100dvh-2rem)] max-h-[800px] w-full max-w-[calc(100vw-2rem)] flex-col gap-0 p-0 md:max-w-4xl [&>button]:hidden',
              'max-md:h-[88dvh] max-md:max-h-[88dvh] max-md:rounded-t-3xl max-md:rounded-b-none max-md:transition-transform max-md:duration-300 max-md:ease-out',
              dragStartYRef.current != null && 'max-md:transition-none',
            )}
            style={isOpen && dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onOpenAutoFocus={(event) => event.preventDefault()}
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
