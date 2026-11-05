'use client';

import { useEffect, useState } from 'react';
import { Button, Checkbox } from '@altitutor/ui';
import { resourcesApi } from '@/features/resources/api/resources';
import type {
  ResourceSubjectNavItem,
  TutorTopicRow,
  TutorResourceFile,
} from '@/features/resources/lib/types';
import type { SessionLessonPlan } from '../types/lesson-plan';
import { tutorCardCn } from '@/shared/lib/tutor-visual';

async function loadPlan(
  sessionID: string,
  signal?: AbortSignal,
): Promise<SessionLessonPlan> {
  const response = await fetch(`/api/sessions/${sessionID}/plan`, {
    signal,
    cache: 'no-store',
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not load the plan.');
  return body;
}

export function SessionLessonPlanEditor({
  sessionID,
  subjectID,
  editable,
}: {
  sessionID: string;
  subjectID: string | null;
  editable: boolean;
}) {
  const [plan, setPlan] = useState<SessionLessonPlan | null>(null);
  const [topicIDs, setTopicIDs] = useState<string[]>([]);
  const [fileIDs, setFileIDs] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [subjects, setSubjects] = useState<ResourceSubjectNavItem[]>([]);
  const [subject, setSubject] = useState(subjectID ?? '');
  const [topics, setTopics] = useState<TutorTopicRow[]>([]);
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<TutorResourceFile[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  function accept(value: SessionLessonPlan) {
    setPlan(value);
    setTopicIDs(value.topics.map((item) => item.id));
    setFileIDs(value.resources.map((item) => item.id));
  }
  useEffect(() => {
    const controller = new AbortController();
    loadPlan(sessionID, controller.signal)
      .then(accept)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [sessionID]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    resourcesApi
      .getMySubjectNavItems()
      .then((value) => {
        if (active) setSubjects(value);
      })
      .catch(() => {
        if (active)
          setError(
            'Could not load subjects. Close and reopen the picker to retry.',
          );
      });
    return () => {
      active = false;
    };
  }, [open]);
  useEffect(() => {
    if (!open || !subject) return;
    let active = true;
    setCatalogBusy(true);
    setTopics([]);
    setTopic('');
    setFiles([]);
    resourcesApi
      .getTopicsBySubject(subject)
      .then((value) => {
        if (active) setTopics(value);
      })
      .catch(() => {
        if (active)
          setError('Could not load topics. Select the subject again to retry.');
      })
      .finally(() => {
        if (active) setCatalogBusy(false);
      });
    return () => {
      active = false;
    };
  }, [open, subject]);
  useEffect(() => {
    if (!topic) return;
    let active = true;
    setFiles([]);
    setCatalogBusy(true);
    resourcesApi
      .getTopicFiles(topic)
      .then((value) => {
        if (active) setFiles(value.filter((file) => !file.isSolutions));
      })
      .catch(() => {
        if (active)
          setError('Could not load files. Select the topic again to retry.');
      })
      .finally(() => {
        if (active) setCatalogBusy(false);
      });
    return () => {
      active = false;
    };
  }, [topic]);
  function toggle(
    id: string,
    values: string[],
    change: (value: string[]) => void,
  ) {
    change(
      values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    );
    setNotice('');
  }
  async function save() {
    if (!plan) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/sessions/${sessionID}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: plan.revision,
          topicIds: topicIDs,
          fileIds: fileIDs,
        }),
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? 'The plan changed or this session has started. Reload the saved plan before editing again.'
            : value.error || 'Could not save the plan.',
        );
      accept(value);
      setOpen(false);
      setNotice('Plan saved');
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Could not save the plan.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className={tutorCardCn('p-4')} aria-label="Session preparation">
      <h3 className="text-lg font-semibold">
        Preparation{' '}
        <span className="text-sm font-normal text-muted-foreground">
          Optional · shared with assigned tutors
        </span>
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Planned files appear when the iPad opens this session. Confirm what you
        taught when logging.
      </p>
      {error && (
        <div role="alert" className="mt-3 text-sm text-destructive">
          {error}{' '}
          <Button
            variant="outline"
            disabled={saving}
            onClick={async () => {
              try {
                accept(await loadPlan(sessionID));
                setOpen(false);
                setError('');
              } catch {
                setError('Could not reload the plan. Please retry.');
              }
            }}
          >
            Reload saved plan
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
      {!plan && !error && <p role="status">Loading preparation…</p>}
      {plan && (
        <>
          {!open && (
            <div className="my-3 space-y-2">
              {!plan.topics.length && !plan.resources.length && (
                <p className="text-sm text-muted-foreground">
                  No preparation added yet.
                </p>
              )}
              {plan.topics.map((item) => (
                <p key={item.id} className="text-sm">
                  {item.code ? `${item.code} · ` : ''}
                  {item.name}
                </p>
              ))}
              {plan.resources.map((item) => (
                <p key={item.id} className="text-sm">
                  {item.worksheet.code ? `${item.worksheet.code} · ` : ''}
                  {item.worksheet.title}
                  {item.solutions ? ' · solutions included' : ''}
                </p>
              ))}
            </div>
          )}
          {editable && !open && (
            <Button
              variant="outline"
              onClick={() => {
                setOpen(true);
                setNotice('');
              }}
            >
              Add topics and files
            </Button>
          )}
          {open && (
            <fieldset disabled={saving} className="mt-4 space-y-3">
              <label className="block text-sm">
                Subject
                <select
                  aria-label="Planning subject"
                  className="ml-2 rounded border bg-background p-2"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                >
                  <option value="">Choose subject</option>
                  {subjects.map((item) => (
                    <option key={item.id} value={item.id ?? ''}>
                      {item.long_name || item.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="max-h-64 overflow-auto rounded border p-3 space-y-3">
                {catalogBusy && <p role="status">Loading catalog…</p>}
                {topics.map(
                  (item) =>
                    item.id && (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            aria-label={`Plan ${item.name}`}
                            checked={topicIDs.includes(item.id)}
                            onCheckedChange={() =>
                              toggle(item.id!, topicIDs, setTopicIDs)
                            }
                          />
                          {item.code ? `${item.code} · ` : ''}
                          {item.name}
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setTopic(item.id!)}
                        >
                          Files for {item.name}
                        </Button>
                      </div>
                    ),
                )}
                {!catalogBusy && subject && !topics.length && (
                  <p className="text-sm">
                    No accessible topics for this subject.
                  </p>
                )}
              </div>
              {topic && (
                <div
                  className="max-h-56 overflow-auto rounded border p-3 space-y-3"
                  aria-label="Catalog files"
                >
                  {files.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        aria-label={`Plan file ${item.filename}`}
                        checked={fileIDs.includes(item.id)}
                        onCheckedChange={() =>
                          toggle(item.id, fileIDs, setFileIDs)
                        }
                      />
                      {item.code} · {item.filename}
                    </label>
                  ))}
                  {!catalogBusy && !files.length && (
                    <p className="text-sm">No catalog files for this topic.</p>
                  )}
                </div>
              )}
              <p className="text-sm">
                {topicIDs.length} topics · {fileIDs.length} files selected
              </p>
              {plan.topics
                .filter((item) => topicIDs.includes(item.id))
                .map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    size="sm"
                    onClick={() => toggle(item.id, topicIDs, setTopicIDs)}
                  >
                    Remove {item.name}
                  </Button>
                ))}
              {plan.resources
                .filter((item) => fileIDs.includes(item.id))
                .map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    size="sm"
                    onClick={() => toggle(item.id, fileIDs, setFileIDs)}
                  >
                    Remove {item.worksheet.title}
                  </Button>
                ))}
              <div className="flex gap-2">
                <Button onClick={save}>
                  {saving ? 'Saving…' : 'Save plan'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    accept(plan);
                    setOpen(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </fieldset>
          )}
        </>
      )}
    </section>
  );
}
