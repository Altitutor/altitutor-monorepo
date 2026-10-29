'use client';

import { Button } from '@altitutor/ui';
import { studentBtnOutline, studentBtnPrimary } from '@/shared/lib/student-visual';

export function SettingsSaveBar({
  visible,
  saving,
  onCancel,
  onSave,
  formId,
  saveDisabled = false,
}: {
  visible: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave?: () => void;
  formId?: string;
  saveDisabled?: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 left-[var(--student-content-inset,0px)] z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2">
      <div
        role="region"
        aria-label="Unsaved settings"
        className="pointer-events-auto flex w-full max-w-5xl flex-wrap items-center justify-end gap-2 rounded-2xl bg-background/95 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)] dark:ring-white/[0.07]"
      >
        <Button type="button" variant="outline" className={studentBtnOutline} onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type={formId ? 'submit' : 'button'} form={formId} className={studentBtnPrimary} onClick={onSave} disabled={saving || saveDisabled}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
