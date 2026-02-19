'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import {
  CONTACT_EMAIL,
  CONTACT_NO_SLOTS_MESSAGE,
  CONTACT_PHONE,
} from '@/shared/constants';

interface ContactUsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactUsDialog({ isOpen, onOpenChange }: ContactUsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Contact us</DialogTitle>
          <DialogDescription>{CONTACT_NO_SLOTS_MESSAGE}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Phone</p>
            <a
              href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`}
              className="text-sm font-medium hover:underline"
            >
              {CONTACT_PHONE}
            </a>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm font-medium hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
