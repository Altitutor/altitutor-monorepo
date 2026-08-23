'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Label,
  RadioGroup,
  RadioGroupItem,
  useToast,
} from '@altitutor/ui';
import { AdminLoadingSkeleton, SettingsPageHeader } from '@/shared/components';
import {
  getOfficePrintSettings,
  updateOfficePrintSettings,
} from '../api/officePrintSettings';
import {
  TUTOR_OFFICE_PRINT_ACCESS_OPTIONS,
  type TutorOfficePrintAccess,
} from '../lib/tutorOfficePrintAccess';

export function OfficePrintSettingsForm() {
  const { toast } = useToast();
  const [access, setAccess] = useState<TutorOfficePrintAccess>('office_hours');
  const [savedAccess, setSavedAccess] = useState<TutorOfficePrintAccess>('office_hours');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await getOfficePrintSettings();
        if (cancelled) return;
        setAccess(settings.tutor_access);
        setSavedAccess(settings.tutor_access);
        setError(null);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load office print settings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const settings = await updateOfficePrintSettings(access);
      setAccess(settings.tutor_access);
      setSavedAccess(settings.tutor_access);
      toast({
        title: 'Office print settings saved',
        description: 'Tutor access to the office printer has been updated.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save office print settings';
      setError(message);
      toast({
        title: 'Couldn’t save office print settings',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AdminLoadingSkeleton variant="card" />;
  }

  return (
    <div className="p-6">
      <SettingsPageHeader
        title="Office print"
        actions={
          <Button onClick={() => void handleSave()} disabled={saving || access === savedAccess}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        }
      />
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Controls when tutors can send files to the office printer. Admins can always print when the
        printer is online. Changing this setting does not cancel jobs that are already queued.
      </p>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      <RadioGroup
        value={access}
        onValueChange={(value) => setAccess(value as TutorOfficePrintAccess)}
        className="max-w-2xl space-y-3"
        aria-label="Tutor office print access"
      >
        {TUTOR_OFFICE_PRINT_ACCESS_OPTIONS.map((option) => (
          <label
            key={option.value}
            htmlFor={`tutor-office-print-${option.value}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4"
          >
            <RadioGroupItem value={option.value} id={`tutor-office-print-${option.value}`} className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor={`tutor-office-print-${option.value}`} className="cursor-pointer font-medium">
                {option.label}
              </Label>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
