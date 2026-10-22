import { Button, Input, SearchableSelect } from '@altitutor/ui';
import { X } from 'lucide-react';
import type { AnswerFilter, AnswerFilterQuestion } from '../lib/answer-filters';

export function FormAnswerFilters({ questions, filters, onChange }: {
  questions: AnswerFilterQuestion[];
  filters: AnswerFilter[];
  onChange: (filters: AnswerFilter[]) => void;
}) {
  const update = (index: number, next: AnswerFilter) => onChange(filters.map((filter, i) => i === index ? next : filter));
  return (
    <div className="space-y-3" aria-label="Answer filters">
      <div className="flex flex-wrap items-center gap-3">
        <SearchableSelect
          items={questions.filter((question) => !filters.some((filter) => filter.questionKey === question.key))}
          value={null}
          onValueChange={(question) => {
            if (question) onChange([...filters, { questionKey: question.key, text: '', values: [] }]);
          }}
          getItemId={(question) => question.key}
          getItemLabel={(question) => question.label}
          ariaLabel="Add answer filter"
          placeholder="Add answer filter"
          searchPlaceholder="Search questions..."
          disabled={!questions.length}
          triggerVariant="outline"
          contentWidth="min(560px, 90vw)"
        />
        {filters.length ? (
          <>
            <span className="text-xs text-muted-foreground">Responses must match all answer filters.</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>Clear answer filters</Button>
          </>
        ) : null}
      </div>
      {filters.map((filter, index) => {
        const question = questions.find((item) => item.key === filter.questionKey);
        if (!question) return null;
        return (
          <div key={filter.questionKey} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
            <span className="min-w-0 text-sm font-medium">{question.label}</span>
            {question.kind === 'text' ? (
              <>
                <span className="text-sm text-muted-foreground">contains</span>
                <Input
                  aria-label={`${question.title} contains`}
                  value={filter.text}
                  onChange={(event) => update(index, { ...filter, text: event.target.value })}
                  placeholder="Enter text..."
                  className="w-64 max-w-full"
                />
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">includes any</span>
                {filter.values.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={`Remove ${question.options.find((option) => option.value === value)?.label ?? 'choice'}`}
                    onClick={() => update(index, { ...filter, values: filter.values.filter((item) => item !== value) })}
                  >
                    {question.options.find((option) => option.value === value)?.label ?? 'Choice'}
                    <X className="ml-1 h-3 w-3" aria-hidden="true" />
                  </Button>
                ))}
                <SearchableSelect
                  items={question.options.filter((option) => !filter.values.includes(option.value))}
                  value={null}
                  onValueChange={(option) => {
                    if (option) update(index, { ...filter, values: [...filter.values, option.value] });
                  }}
                  getItemId={(option) => option.value}
                  getItemLabel={(option) => option.label}
                  ariaLabel={`${question.title} includes any`}
                  placeholder="Select choices..."
                  searchPlaceholder="Search choices..."
                  emptyMessage="No more saved choices."
                  triggerVariant="outline"
                />
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove filter for ${question.title}`}
              onClick={() => onChange(filters.filter((_, i) => i !== index))}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
