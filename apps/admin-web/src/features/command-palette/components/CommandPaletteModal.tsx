'use client';

import { useEffect, useRef, useState, type TouchEvent } from 'react';
import {
  lockOverlayPageScroll,
  overlayPinStyle,
  useMediaQuery,
  useVisualViewportRect,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { AdminDialogShell } from '@/shared/components';
import { CommandPalette } from './CommandPalette';
import { useEntityModals } from '@/shared/contexts/EntityModalContext';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CommandPaletteModal - Wrapper component with backdrop
 * Provides the darkened background overlay for the Raycast-like search experience
 */
export function CommandPaletteModal({ isOpen, onClose }: CommandPaletteModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const entityModals = useEntityModals();
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
    entityModals.openEntity(type as Parameters<typeof entityModals.openEntity>[0], id);
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
          'fixed inset-0 z-[101] flex flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] shadow-2xl ring-1 ring-black/10 transition-transform duration-300 ease-out overscroll-none dark:bg-brand-dark-bg dark:ring-white/10 md:hidden',
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
        <CommandPalette isOpen={isOpen} onClose={onClose} onEntitySelected={handleEntitySelected} />
      </div>

      {isDesktop ? (
        <AdminDialogShell
          open={isOpen}
          onClose={onClose}
          title="Command palette"
          fillHeight
          hideHeader
          contentClassName="z-[101] border bg-popover shadow-xl md:max-w-4xl"
          bodyClassName="min-h-0 flex-1 overflow-hidden p-0"
          dialogContentProps={{
            onOpenAutoFocus: (event) => event.preventDefault(),
          }}
        >
          <CommandPalette isOpen={isOpen} onClose={onClose} onEntitySelected={handleEntitySelected} />
        </AdminDialogShell>
      ) : null}
    </>
  );
}
