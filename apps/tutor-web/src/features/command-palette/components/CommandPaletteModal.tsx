'use client';

import { useEffect, useRef, useState, type TouchEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogPortal,
  lockOverlayPageScroll,
  overlayPinStyle,
  useMediaQuery,
  useVisualViewportRect,
} from '@altitutor/ui';
import { ViewClassModal } from '@/features/classes';
import { cn } from '@/shared/utils';
import { tutorDialogContentClass } from '@/shared/lib/tutor-visual';
import { CommandPalette } from './CommandPalette';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPaletteModal({ isOpen, onClose }: CommandPaletteModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const viewportRect = useVisualViewportRect(isOpen && !isDesktop);

  useEffect(() => {
    if (!isOpen) {
      dragStartYRef.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
      return;
    }

    if (isDesktop) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }

    return lockOverlayPageScroll();
  }, [isOpen, isDesktop]);

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

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] bg-black/60 md:hidden"
          onClick={onClose}
        />
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={cn(
          'fixed inset-0 z-[101] flex flex-col overflow-hidden border-0 bg-card pt-[env(safe-area-inset-top)] shadow-2xl ring-1 ring-black/10 transition-transform duration-300 ease-out overscroll-none dark:bg-brand-dark-card dark:ring-white/10 md:hidden',
          dragStartYRef.current != null && 'transition-none',
          isOpen ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        )}
        style={overlayPinStyle({
          viewport: isOpen ? viewportRect : null,
          dragOffset: isOpen ? dragOffset : 0,
        })}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <CommandPalette
          isOpen={isOpen}
          onClose={onClose}
          onEntitySelected={handleEntitySelected}
        />
      </div>

      {isDesktop ? (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DialogPortal>
            <DialogContent
              className={cn(
                tutorDialogContentClass,
                'z-[101] flex w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 md:max-w-4xl md:h-[min(800px,calc(100dvh-2rem))] md:min-h-[min(800px,calc(100dvh-2rem))] md:max-h-[min(800px,calc(100dvh-2rem))] [&>button]:hidden',
              )}
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
      ) : null}

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
