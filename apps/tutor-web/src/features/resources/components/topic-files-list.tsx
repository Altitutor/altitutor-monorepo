'use client';

import { useState } from 'react';
import { formatResourceTypeLabel, groupFilesByType, pairFilesWithSolutions } from '@altitutor/shared';
import { getResourceTypeIcon } from '../lib/resource-type-icons';
import type { TutorResourceFile } from '../lib/types';
import {
  ClickableCardIcon,
  ClickableCardRevealChevron,
  clickableCardFocusWithinCn,
  clickableCardHoverCn,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { tutorCardCn } from '@/shared/lib/tutor-visual';
import { OfficePrintConfirmDialog } from '@/features/office-print/components/OfficePrintConfirmDialog';
import { canPrintToOffice } from '../lib/file-actions';
import { useTutorOfficePrintAccess } from '@/features/office-print/hooks/useTutorOfficePrintAccess';
import { isTutorOfficePrintVisible } from '@/features/office-print/lib/tutorOfficePrintAccess';
import { ResourceFileActionsMenu } from './resource-file-actions-menu';
import { ResourceFilePreviewDialog } from './resource-file-preview-dialog';

export function TopicFilesList({
  files,
  getFileHref,
}: {
  files: TutorResourceFile[];
  getFileHref: (fileCode: string) => string;
}) {
  const [previewFile, setPreviewFile] = useState<TutorResourceFile | null>(null);
  const [printFile, setPrintFile] = useState<TutorResourceFile | null>(null);
  const { access } = useTutorOfficePrintAccess();
  const officePrintEnabled = isTutorOfficePrintVisible(access);

  if (!files.length) {
    return <p className="text-sm text-muted-foreground">No files available for this topic.</p>;
  }

  const grouped = groupFilesByType(files);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, typeFiles]) => {
        const pairs = pairFilesWithSolutions(typeFiles) as Array<{
          primary: TutorResourceFile;
          solution: TutorResourceFile | null;
        }>;
        const Icon = getResourceTypeIcon(type);
        return (
          <section key={type}>
            <h3 className="mb-4 text-2xl font-semibold">{formatResourceTypeLabel(type)}</h3>
            <div className="space-y-3">
              {pairs.map(({ primary, solution }) => (
                <div
                  key={primary.id}
                  className={cn('grid gap-3', solution ? 'md:grid-cols-2' : undefined)}
                >
                  <TopicFileCard
                    file={primary}
                    icon={Icon}
                    getFileHref={getFileHref}
                    onPreview={setPreviewFile}
                    onPrintToOffice={setPrintFile}
                    officePrintEnabled={officePrintEnabled}
                  />
                  {solution ? (
                    <TopicFileCard
                      file={solution}
                      icon={Icon}
                      eyebrow="Solution"
                      getFileHref={getFileHref}
                      onPreview={setPreviewFile}
                      onPrintToOffice={setPrintFile}
                      officePrintEnabled={officePrintEnabled}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <ResourceFilePreviewDialog
        file={previewFile}
        open={Boolean(previewFile)}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null);
        }}
        filePageHref={previewFile ? getFileHref(previewFile.code) : ''}
      />
      <OfficePrintConfirmDialog
        open={Boolean(printFile)}
        onOpenChange={(open) => {
          if (!open) setPrintFile(null);
        }}
        fileId={printFile?.fileId ?? null}
        filename={printFile?.filename ?? 'document.pdf'}
      />
    </div>
  );
}

function TopicFileCard({
  file,
  icon: Icon,
  eyebrow,
  getFileHref,
  onPreview,
  onPrintToOffice,
  officePrintEnabled,
}: {
  file: TutorResourceFile;
  icon: ReturnType<typeof getResourceTypeIcon>;
  eyebrow?: string;
  getFileHref: (fileCode: string) => string;
  onPreview: (file: TutorResourceFile) => void;
  onPrintToOffice: (file: TutorResourceFile) => void;
  officePrintEnabled: boolean;
}) {
  return (
    <div
      className={cn(
        tutorCardCn('group relative overflow-hidden p-4'),
        clickableCardHoverCn,
        clickableCardFocusWithinCn,
      )}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 rounded-2xl"
        onClick={() => onPreview(file)}
        aria-label={`Preview ${file.filename}`}
      />
      <div className="pointer-events-none relative z-[1] flex items-center gap-3">
        <ClickableCardIcon icon={Icon} size="sm" />
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <span className="block truncate text-sm font-medium leading-snug tracking-tight text-card-foreground">
            {file.code} · {file.filename}
          </span>
        </div>
        <ClickableCardRevealChevron size="sm" />
        <div className="pointer-events-auto shrink-0">
          <ResourceFileActionsMenu
            file={file}
            openInPageHref={getFileHref(file.code)}
            onPrintToOffice={officePrintEnabled && canPrintToOffice(file) ? () => onPrintToOffice(file) : undefined}
            trigger="icon"
          />
        </div>
      </div>
    </div>
  );
}
