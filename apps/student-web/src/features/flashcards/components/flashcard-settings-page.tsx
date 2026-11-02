'use client';

import { useEffect, useState } from 'react';
import { Input } from '@altitutor/ui';
import { SettingsPageHeader } from '@/features/settings/components/SettingsPageHeader';
import { SettingsRow } from '@/features/settings/components/SettingsRow';
import { SettingsSaveBar } from '@/features/settings/components/SettingsSaveBar';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

type PresetPreference = {
  id: string;
  name: string;
  defaultRetention: number;
  desiredRetention: number | null;
  optimizedAt: string | null;
};

const NUMBER_INPUT_CLASS = 'w-full tabular-nums sm:w-28';

type SettingsSnapshot = {
  newLimit: number;
  reviewLimit: number;
  timezone: string;
  presets: PresetPreference[];
};

function retention(preset: PresetPreference) {
  return preset.desiredRetention ?? preset.defaultRetention;
}

export function FlashcardSettingsPage() {
  const [newLimit, setNewLimit] = useState(20);
  const [reviewLimit, setReviewLimit] = useState(200);
  const [timezone, setTimezone] = useState('Australia/Adelaide');
  const [browserTimezone, setBrowserTimezone] = useState('');
  const [pendingTimezone, setPendingTimezone] = useState<string | null>(null);
  const [presets, setPresets] = useState<PresetPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSettings, setSavedSettings] = useState<SettingsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBrowserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    void Promise.all([
      fetch('/api/flashcards/preferences').then((response) => {
        if (!response.ok) throw new Error('Unable to load preferences');
        return response.json();
      }),
      fetch('/api/flashcards/presets').then((response) => {
        if (!response.ok) throw new Error('Unable to load presets');
        return response.json();
      }),
    ])
      .then(([preferences, presetResult]) => {
        if (cancelled) return;
        const data = preferences.data;
        setNewLimit(data.new_cards_per_study_day);
        setReviewLimit(data.review_cards_per_study_day);
        setTimezone(data.pending_timezone ?? data.timezone);
        setPendingTimezone(data.pending_timezone);
        setPresets(presetResult.data ?? []);
        setSavedSettings({
          newLimit: data.new_cards_per_study_day,
          reviewLimit: data.review_cards_per_study_day,
          timezone: data.pending_timezone ?? data.timezone,
          presets: presetResult.data ?? [],
        });
      })
      .catch((loadError) => {
        console.error('Failed to load flashcard settings:', loadError);
        if (!cancelled) setError('Could not load flashcard settings. Please refresh and try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const studyChanged = savedSettings !== null && (
    newLimit !== savedSettings.newLimit || reviewLimit !== savedSettings.reviewLimit || timezone !== savedSettings.timezone
  );
  const changedPresets = savedSettings ? presets.filter((preset) => {
    const saved = savedSettings.presets.find((item) => item.id === preset.id);
    return saved && retention(preset) !== retention(saved);
  }) : [];
  const isDirty = studyChanged || changedPresets.length > 0;

  const cancelChanges = () => {
    if (!savedSettings) return;
    setNewLimit(savedSettings.newLimit);
    setReviewLimit(savedSettings.reviewLimit);
    setTimezone(savedSettings.timezone);
    setPresets(savedSettings.presets);
    setError(null);
  };

  const saveChanges = async () => {
    if (!savedSettings || !isDirty || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const saveStudy = async () => {
        const response = await fetch('/api/flashcards/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newLimit, reviewLimit, timezone }),
        });
        if (!response.ok) throw new Error('Unable to save study settings');
        const { data } = await response.json();
        setPendingTimezone(data.pending_timezone);
        setSavedSettings((current) => current && ({ ...current, newLimit, reviewLimit, timezone }));
      };
      const results = await Promise.allSettled([
        ...(studyChanged ? [saveStudy()] : []),
        ...changedPresets.map(async (preset) => {
          const response = await fetch('/api/flashcards/presets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presetId: preset.id, desiredRetention: retention(preset) }),
          });
          if (!response.ok) throw new Error('Unable to save retention settings');
          setSavedSettings((current) => current && ({
            ...current,
            presets: current.presets.map((item) => item.id === preset.id ? preset : item),
          }));
        }),
      ]);
      if (results.some((result) => result.status === 'rejected')) {
        setError('Some settings could not be saved. Your remaining changes are ready to retry.');
      }
    } catch (saveError) {
      console.error('Failed to save flashcard settings:', saveError);
      setError('Your settings could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StudentPageContainer className="space-y-6 pb-28">
      <SettingsPageHeader
        title="Flashcard settings"
        description="Choose your daily study allowances, study-day timezone, and retention targets."
        backHref="/settings"
        backLabel="All settings"
      />

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <section className={cn(studentCardCn(), 'p-6 sm:p-8')} aria-labelledby="daily-study-heading">
        <div className="mb-6">
          <h2 id="daily-study-heading" className="text-lg font-semibold">Daily study</h2>
          <p className="mt-1 text-sm text-muted-foreground">Allowances are shared across every subject and reset at your 4 am study-day boundary.</p>
        </div>
        <SettingsRow
          title="New cards"
          description="The maximum number of New cards introduced each study day. Use 9999 for effectively unlimited."
          control={
            <Input
              aria-label="New cards per study day"
              type="number"
              min={0}
              max={9999}
              value={newLimit}
              disabled={isLoading || isSaving || !savedSettings}
              className={NUMBER_INPUT_CLASS}
              onChange={(event) => setNewLimit(Number(event.target.value))}
            />
          }
        />
        <SettingsRow
          title="Review cards"
          description="The maximum number of Review cards shown each study day. Learning and Relearning repetitions do not consume this allowance."
          control={
            <Input
              aria-label="Review cards per study day"
              type="number"
              min={0}
              max={9999}
              value={reviewLimit}
              disabled={isLoading || isSaving || !savedSettings}
              className={NUMBER_INPUT_CLASS}
              onChange={(event) => setReviewLimit(Number(event.target.value))}
            />
          }
        />
        <SettingsRow
          title="Study-day timezone"
          description={
            <>
              Your flashcard day runs from 4 am to 4 am. Timezone changes take effect at the next boundary.
              <span className="mt-1 block">Browser suggestion: {browserTimezone || 'Detecting…'}</span>
              {pendingTimezone ? <span className="mt-1 block text-amber-600">Pending: {pendingTimezone}</span> : null}
            </>
          }
          control={
            <Input
              aria-label="Study-day timezone"
              value={timezone}
              disabled={isLoading || isSaving || !savedSettings}
              className="w-full sm:w-64"
              onChange={(event) => setTimezone(event.target.value)}
            />
          }
        />
      </section>

      <section className={cn(studentCardCn(), 'p-6 sm:p-8')} aria-labelledby="retention-heading">
        <div className="mb-6">
          <h2 id="retention-heading" className="text-lg font-semibold">Desired retention</h2>
          <p className="mt-1 text-sm text-muted-foreground">Set your target for each subject preset from 0.80 to 0.95. Higher targets schedule more reviews.</p>
        </div>
        {presets.length ? presets.map((preset) => (
          <SettingsRow
            key={preset.id}
            title={preset.name}
            description={preset.optimizedAt
              ? `FSRS parameters optimised ${new Date(preset.optimizedAt).toLocaleDateString()}.`
              : 'Uses the preset’s current FSRS parameters.'}
            control={
              <Input
                aria-label={`${preset.name} desired retention`}
                type="number"
                min={0.8}
                max={0.95}
                step={0.01}
                value={preset.desiredRetention ?? preset.defaultRetention}
                disabled={isLoading || isSaving || !savedSettings}
                className={NUMBER_INPUT_CLASS}
                onChange={(event) => setPresets((current) => current.map((item) => item.id === preset.id
                  ? { ...item, desiredRetention: Number(event.target.value) }
                  : item))}
              />
            }
          />
        )) : (
          <p className="text-sm text-muted-foreground">{isLoading ? 'Loading retention settings…' : 'No flashcard presets are assigned yet.'}</p>
        )}
      </section>
      <SettingsSaveBar visible={isDirty} saving={isSaving} onCancel={cancelChanges} onSave={() => void saveChanges()} />
    </StudentPageContainer>
  );
}
