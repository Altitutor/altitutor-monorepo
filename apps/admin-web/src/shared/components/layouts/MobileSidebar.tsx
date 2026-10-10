'use client';

import { useEffect, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMediaQuery } from '@altitutor/ui';

export function MobileSidebar({ isOpen, onClose, children }: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const desktop = useMediaQuery('(min-width: 768px)');

  useEffect(() => { onClose(); }, [pathname, onClose]);
  useEffect(() => { if (desktop) onClose(); }, [desktop, onClose]);

  return (
    <Dialog.Root open={isOpen && !desktop} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-mobile-menu-overlay
          className="fixed inset-x-0 bottom-0 top-[var(--navbar-height)] z-[70] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 md:hidden"
        />
        <Dialog.Content
          id="admin-mobile-sidebar"
          aria-describedby={undefined}
          className="fixed bottom-0 left-0 top-[var(--navbar-height)] z-[80] flex w-[250px] max-w-[85vw] flex-col bg-card shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left md:hidden"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.querySelector<HTMLButtonElement>('button[aria-controls="admin-mobile-sidebar"]')?.focus();
          }}
          onClick={(event) => {
            // Also dismiss when selecting an already-active primary link.
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
            if (link && link.getAttribute('target') !== '_blank') onClose();
          }}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
            <Dialog.Title className="text-lg font-semibold">Altitutor Admin</Dialog.Title>
            <Dialog.Close className="rounded-md p-2 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" aria-label="Close menu">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
