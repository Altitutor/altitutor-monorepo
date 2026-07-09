'use client';

import * as React from 'react';
import type { FormAnswerPayload, FormBlock, FormQuestion } from '@altitutor/shared';
import { isQuestionBlock } from '@altitutor/shared';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Input } from '../input';
import { Label } from '../label';
import { RadioGroup, RadioGroupItem } from '../radio-group';
import { Slider } from '../slider';
import { Textarea } from '../textarea';
import { RichTextEditor } from '../rich-text-editor';
import { cn } from '../../lib/cn';
import type { JSONContent } from '@tiptap/core';

export interface FormAnswererProps {
  title: string;
  blocks: FormBlock[];
  thankYouMessage?: string;
  submitLabel?: string;
  disabled?: boolean;
  onSubmit: (answers: FormAnswerPayload) => Promise<void> | void;
  className?: string;
}

function emptyValueForQuestion(question: FormQuestion) {
  if (question.type === 'multi_select') return [];
  if (question.type === 'number') return '';
  return '';
}

function getInitialAnswers(blocks: FormBlock[]): FormAnswerPayload {
  const answers: FormAnswerPayload = {};
  for (const block of blocks) {
    if (isQuestionBlock(block)) {
      answers[block.id] = emptyValueForQuestion(block);
    }
  }
  return answers;
}

function QuestionLabel({ block }: { block: FormQuestion }) {
  return (
    <div className="space-y-1">
      <Label className="text-base font-medium">
        {block.title}
        {block.required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {block.description ? (
        <p className="text-sm text-muted-foreground">{block.description}</p>
      ) : null}
    </div>
  );
}

export function FormAnswerer({
  title,
  blocks,
  thankYouMessage = 'Thanks for your response.',
  submitLabel = 'Submit',
  disabled,
  onSubmit,
  className,
}: FormAnswererProps) {
  const [answers, setAnswers] = React.useState<FormAnswerPayload>(() => getInitialAnswers(blocks));
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setAnswers(getInitialAnswers(blocks));
    setSubmitted(false);
    setError(null);
  }, [blocks]);

  const setAnswer = React.useCallback((id: string, value: FormAnswerPayload[string]) => {
    setAnswers((current) => ({ ...current, [id]: value }));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(answers);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit this form.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={cn('mx-auto max-w-2xl px-4 py-10', className)}>
        <div className="rounded-md border bg-background p-6">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-muted-foreground">{thankYouMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('mx-auto max-w-2xl px-4 py-8', className)}>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="space-y-8">
        {blocks.map((block) => {
          if (block.type === 'content') {
            return (
              <section key={block.id} className="space-y-4">
                {block.title ? <h2 className="text-xl font-semibold">{block.title}</h2> : null}
                <div className="rounded-md border bg-muted/20 p-4">
                  <RichTextEditor
                    content={block.body as JSONContent}
                    editable={false}
                    autoHeight
                    minHeight="0"
                  />
                </div>
                {block.buttons?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {block.buttons.map((button) => (
                      <Button
                        key={button.id}
                        type="button"
                        variant={button.style === 'primary' ? 'default' : 'outline'}
                        onClick={() => {
                          if (button.openInNewTab || !button.href.startsWith('/')) {
                            window.open(button.href, '_blank', 'noopener,noreferrer');
                          } else {
                            window.location.href = button.href;
                          }
                        }}
                      >
                        {button.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          }

          if (block.type === 'single_choice') {
            return (
              <section key={block.id} className="space-y-3">
                <QuestionLabel block={block} />
                <RadioGroup
                  value={String(answers[block.id] ?? '')}
                  onValueChange={(value) => setAnswer(block.id, value)}
                  required={block.required}
                >
                  {block.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-3 rounded-md border p-3">
                      <RadioGroupItem value={option.value} />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </section>
            );
          }

          if (block.type === 'multi_select') {
            const selected = Array.isArray(answers[block.id]) ? answers[block.id] as string[] : [];
            return (
              <section key={block.id} className="space-y-3">
                <QuestionLabel block={block} />
                <div className="space-y-2">
                  {block.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-3 rounded-md border p-3">
                      <Checkbox
                        checked={selected.includes(option.value)}
                        onCheckedChange={(checked) => {
                          setAnswer(
                            block.id,
                            checked
                              ? [...selected, option.value]
                              : selected.filter((value) => value !== option.value)
                          );
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          }

          if (block.type === 'long_text') {
            return (
              <section key={block.id} className="space-y-3">
                <QuestionLabel block={block} />
                <Textarea
                  value={String(answers[block.id] ?? '')}
                  onChange={(event) => setAnswer(block.id, event.target.value)}
                  required={block.required}
                  rows={5}
                />
              </section>
            );
          }

          if (block.type === 'number') {
            const min = block.min ?? (block.display === 'rating' ? 1 : 0);
            const max = block.max ?? (block.display === 'rating' ? 5 : 100);
            const step = block.step ?? 1;
            const value = Number(answers[block.id] || min);
            return (
              <section key={block.id} className="space-y-3">
                <QuestionLabel block={block} />
                {block.display === 'slider' || block.display === 'rating' ? (
                  <div className="space-y-2">
                    <Slider
                      value={[value]}
                      onValueChange={([next]) => setAnswer(block.id, next)}
                      min={min}
                      max={max}
                      step={step}
                    />
                    <div className="text-sm text-muted-foreground">{value}</div>
                  </div>
                ) : (
                  <Input
                    type="number"
                    value={String(answers[block.id] ?? '')}
                    onChange={(event) => setAnswer(block.id, event.target.value === '' ? '' : Number(event.target.value))}
                    required={block.required}
                    min={block.min}
                    max={block.max}
                    step={block.step}
                  />
                )}
              </section>
            );
          }

          return (
            <section key={block.id} className="space-y-3">
              <QuestionLabel block={block} />
              <Input
                value={String(answers[block.id] ?? '')}
                onChange={(event) => setAnswer(block.id, event.target.value)}
                required={block.required}
              />
            </section>
          );
        })}
      </div>

      {error ? (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mt-8">
        <Button type="submit" disabled={disabled || submitting}>
          {submitting ? 'Submitting...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
