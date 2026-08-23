'use client';

import { useEffect, useState } from 'react';
import { OfficePrintConfirmDialog } from '@/features/office-print/components/OfficePrintConfirmDialog';
import { TutorDialogShell } from '@/shared/components/tutor-dialog-shell';
import { canPrintToOffice } from '../lib/file-actions';
import { useTutorOfficePrintAccess } from '@/features/office-print/hooks/useTutorOfficePrintAccess';
import { isTutorOfficePrintVisible } from '@/features/office-print/lib/tutorOfficePrintAccess';
import type { TutorResourceFile } from '../lib/types';
import { useResourceSignedFileUrl } from '../hooks/useResources';
import { ResourceFileActionsMenu } from './resource-file-actions-menu';
import { ResourceFileViewer } from './resource-file-viewer';

export function ResourceFilePreviewDialog({
  file,
  open,
  onOpenChange,
  filePageHref,
}: {
  file: TutorResourceFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePageHref: string;
}) {
  const [officePrintOpen, setOfficePrintOpen] = useState(false);
  const { access } = useTutorOfficePrintAccess();
  const officePrintEnabled = isTutorOfficePrintVisible(access);
  const { data: signedUrl, isLoading } = useResourceSignedFileUrl(
    open ? (file?.topicId ?? null) : null,
    open ? (file?.code ?? null) : null,
  );

  useEffect(() => {
    if (!open) setOfficePrintOpen(false);
  }, [open]);

  return (
    <>
      <TutorDialogShell
        open={open}
        onOpenChange={(next) => {
          if (!next) setOfficePrintOpen(false);
          onOpenChange(next);
        }}
        title={file ? `${file.code} · ${file.filename}` : 'File preview'}
        headerActions={
          file ? (
            <ResourceFileActionsMenu
              file={file}
              openInPageHref={filePageHref}
              onPrintToOffice={officePrintEnabled && canPrintToOffice(file) ? () => setOfficePrintOpen(true) : undefined}
              trigger="icon"
            />
          ) : null
        }
      >
        {file && !isLoading ? (
          <ResourceFileViewer
            filename={file.filename}
            mimetype={file.mimetype}
            resourceType={file.type}
            externalUrl={file.externalUrl}
            signedUrl={signedUrl ?? null}
            frameClassName="h-full"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Loading preview…</p>
        )}
      </TutorDialogShell>
      <OfficePrintConfirmDialog
        open={officePrintOpen}
        onOpenChange={setOfficePrintOpen}
        fileId={file?.fileId ?? null}
        filename={file?.filename ?? 'document.pdf'}
      />
    </>
  );
}
