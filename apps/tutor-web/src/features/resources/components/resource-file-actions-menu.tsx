'use client';

import Link from 'next/link';
import { Building2, ExternalLink, MoreVertical } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { tutorBtnIconOutline, tutorBtnOutline } from '@/shared/lib/tutor-visual';
import { canPrintToOffice } from '../lib/file-actions';
import type { TutorResourceFile } from '../lib/types';

export function ResourceFileActionsMenu({
  file,
  openInPageHref,
  onPrintToOffice,
  trigger = 'icon',
}: {
  file: TutorResourceFile;
  openInPageHref?: string;
  onPrintToOffice?: () => void;
  trigger?: 'icon' | 'labeled';
}) {
  const showPrint = Boolean(onPrintToOffice) && canPrintToOffice(file);
  const showOpenInPage = Boolean(openInPageHref);

  if (!showPrint && !showOpenInPage) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={trigger === 'icon' ? 'icon' : 'default'}
          aria-label="Actions"
          className={cn(trigger === 'icon' ? tutorBtnIconOutline : tutorBtnOutline)}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className={cn('h-4 w-4', trigger === 'labeled' && 'mr-2')} />
          {trigger === 'labeled' ? 'Actions' : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {showOpenInPage && openInPageHref ? (
          <DropdownMenuItem asChild>
            <Link href={openInPageHref}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in page
            </Link>
          </DropdownMenuItem>
        ) : null}
        {showPrint ? (
          <DropdownMenuItem
            onSelect={() => {
              onPrintToOffice?.();
            }}
          >
            <Building2 className="mr-2 h-4 w-4" />
            Print to office
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
