'use client';

import { FillFormDialog } from './FillFormDialog';

export function SessionFormResponseDialog({
  sessionId,
  formId,
  open,
  onOpenChange,
  onSaved,
}: {
  sessionId: string;
  formId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const close = () => {
    onOpenChange(false);
  };

  return (
    <FillFormDialog
      open={open && Boolean(formId)}
      onClose={close}
      sessionId={sessionId}
      lockedFormId={formId ?? undefined}
      onSaved={() => onSaved()}
    />
  );
}
