'use client';

import { Info, X } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@altitutor/ui';
import {
  tutorBtnIconOutline,
  tutorDialogContentClass,
  tutorDialogHeaderStrip,
} from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';
import { PayTierHowItWorksContent } from './PayTierHowItWorksContent';

export function PayTierHowItWorksDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(tutorBtnIconOutline, 'size-8 shrink-0')}
          aria-label="How pay tiers work"
        >
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          tutorDialogContentClass,
          'flex w-full max-h-[min(90dvh,820px)] flex-col gap-0 overflow-hidden p-0 md:max-w-5xl [&>button]:hidden',
        )}
      >
        <DialogHeader className={cn(tutorDialogHeaderStrip, 'shrink-0 px-6 py-4')}>
          <div className="flex items-center gap-3">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="icon" className={tutorBtnIconOutline}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
            <div className="min-w-0">
              <DialogTitle>How pay tiers work</DialogTitle>
              <DialogDescription>
                A quick overview of how you move up the pay ladder.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <PayTierHowItWorksContent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
