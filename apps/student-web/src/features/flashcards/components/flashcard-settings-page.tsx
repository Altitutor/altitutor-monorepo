'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@altitutor/ui';
import { Save } from 'lucide-react';
import { SettingsPageHeader } from '@/features/settings/components/SettingsPageHeader';
import { SettingsRow } from '@/features/settings/components/SettingsRow';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentBtnPrimary, studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

type PresetPreference = {
  id: string;
  name: string;
  defaultRetention: number;
  desiredRetention: number | null;
  optimizedAt: string | null;
};

const NUMBER_INPUT_CLASS = 'w-full tabular-nums sm:w-28';

export function FlashcardSettingsPage() {
  const [newLimit, setNewLimit] = useState(20);
  const [reviewLimit, setReviewLimit] = useState(200);
  const [timezone, setTimezone] = useState('Australia/Adelaide');
  const [browserTimezone, setBrowserTimezone] = useState('');
  const [pendingTimezone, setPendingTimezone] = useState<string | null>(null);
  const [presets, setPresets] = useState<PresetPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<'study' | 'retention' | null>(null);
  const [savedSection, setSavedSection] = useState<'study' | 'retention' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBrowserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    void Promise.all([
      fetch('/api/flashcards/preferences').then((response) => response.json()),
      fetch('/api/flashcards/presets').then((response) => response.json()),
    ])
      .then(([preferences, presetResult]) => {
        if (cancelled) return;
        const data = preferences.data;
        setNewLimit(data.new_cards_per_study_day);
        setReviewLimit(data.review_cards_per_study_day);
        setTimezone(data.pending_timezone ?? data.timezone);
        setPendingTimezone(data.pending_timezone);
        setPresets(presetResult.data ?? []);
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

  const saveStudySettings = async () => {
    setSavingSection('study');
    setSavedSection(null);
    setError(null);
    try {
      const response = await fetch('/api/flashcards/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newLimit, reviewLimit, timezone }),
      });
      if (!response.ok) throw new Error('Unable to save study settings');
      const { data } = await response.json();
      setPendingTimezone(data.pending_timezone);
      setSavedSection('study');
    } catch (saveError) {
      console.error('Failed to save flashcard study settings:', saveError);
      setError('Your study settings could not be saved. Please try again.');
    } finally {
      setSavingSection(null);
    }
  };

  const saveRetentionSettings = async () => {
    setSavingSection('retention');
    setSavedSection(null);
    setError(null);
    try {
      const responses = await Promise.all(presets.map((preset) => fetch('/api/flashcards/presets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetId: preset.id,
          desiredRetention: preset.desiredRetention ?? preset.defaultRetention,
        }),
      })));
      if (responses.some((response) => !response.ok)) throw new Error('Unable to save retention settings');
      setSavedSection('retention');
    } catch (saveError) {
      console.error('Failed to save flashcard retention settings:', saveError);
      setError('Your retention settings could not be saved. Please try again.');
    } finally {
      setSavingSection(null);
    }
  };

  return (
    <StudentPageContainer className="space-y-6">
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
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
              className="w-full sm:w-64"
              onChange={(event) => setTimezone(event.target.value)}
            />
          }
        />
        <div className="mt-6 flex items-center justify-end gap-3">
          {savedSection === 'study' ? <span className="text-sm text-muted-foreground">Saved</span> : null}
          <Button className={studentBtnPrimary} onClick={() => void saveStudySettings()} disabled={isLoading || savingSection !== null}>
            <Save className="mr-2 h-4 w-4" />
            {savingSection === 'study' ? 'Saving…' : 'Save daily study'}
          </Button>
        </div>
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
                disabled={isLoading}
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
        {presets.length ? (
          <div className="mt-6 flex items-center justify-end gap-3">
            {savedSection === 'retention' ? <span className="text-sm text-muted-foreground">Saved</span> : null}
            <Button variant="outline" onClick={() => void saveRetentionSettings()} disabled={isLoading || savingSection !== null}>
              <Save className="mr-2 h-4 w-4" />
              {savingSection === 'retention' ? 'Saving…' : 'Save retention'}
            </Button>
          </div>
        ) : null}
      </section>
    </StudentPageContainer>
  );
}
