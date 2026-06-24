'use client';

import { useMemo, useState } from 'react';
import { buildTopicTree, flattenTopicsDfs, type ResourceTopicNode } from '@altitutor/shared';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  ScrollArea,
} from '@altitutor/ui';
import { ChevronRight, Layers } from 'lucide-react';
import { ResourcesBreadcrumb, useResourceSubjects } from '@/features/resources';
import { resourcesApi } from '@/features/resources/api/resources';
import type { ResourceSubject, StudentTopicRow } from '@/features/resources/lib/types';
import { FlashcardReviewSession, useDueFlashcardReviewCards } from '@/features/flashcards';
import { StudentPageContainer } from '@/shared/components/layouts';
import { cn } from '@/shared/utils';
import { useQuery } from '@tanstack/react-query';

type SubjectTopicTree = {
  subject: ResourceSubject;
  topics: StudentTopicRow[];
  tree: ResourceTopicNode[];
};

type Selection =
  | { type: 'all'; label: string; topicIds: null }
  | { type: 'topic'; label: string; topicId: string; topicIds: string[] };

function collectTopicIds(node: ResourceTopicNode): string[] {
  return flattenTopicsDfs([node]).map((topic) => topic.id);
}

function TopicSelectorNode({
  node,
  selectedTopicId,
  onSelect,
}: {
  node: ResourceTopicNode;
  selectedTopicId: string | null;
  onSelect: (node: ResourceTopicNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const selected = selectedTopicId === node.id;

  return (
    <li>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          disabled={!hasChildren}
          aria-label={expanded ? `Collapse ${node.code}` : `Expand ${node.code}`}
          aria-expanded={hasChildren ? expanded : undefined}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
            hasChildren ? 'hover:bg-muted' : 'cursor-default opacity-0',
          )}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
        </button>

        <button
          type="button"
          onClick={() => onSelect(node)}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
            selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
          )}
        >
          <span className="min-w-0 truncate">
            <span className="font-medium">{node.code}</span>
            <span className="text-muted-foreground"> · {node.name}</span>
          </span>
          {hasChildren ? (
            <Badge variant="secondary" className="shrink-0">
              {node.children.length}
            </Badge>
          ) : null}
        </button>
      </div>

      {hasChildren ? (
        <div className={cn('grid transition-all', expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
          <div className="overflow-hidden pl-4">
            <ul className="mt-1 space-y-1">
              {node.children.map((child) => (
                <TopicSelectorNode
                  key={child.id}
                  node={child}
                  selectedTopicId={selectedTopicId}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function TopicHierarchyPanel({
  subjects,
  selection,
  onSelectAll,
  onSelectTopic,
}: {
  subjects: SubjectTopicTree[];
  selection: Selection;
  onSelectAll: () => void;
  onSelectTopic: (subject: ResourceSubject, node: ResourceTopicNode) => void;
}) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Topics</h2>
          <p className="text-sm text-muted-foreground">Choose a topic subtree.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={selection.type === 'all' ? 'default' : 'outline'}
          onClick={onSelectAll}
          className="gap-1.5"
        >
          <Layers className="h-4 w-4" />
          Review All
        </Button>
      </div>

      <ScrollArea className="h-[min(680px,calc(100vh-13rem))] rounded-lg border bg-card">
        <Accordion
          type="multiple"
          defaultValue={subjects.map((item) => item.subject.id).filter((id): id is string => Boolean(id))}
          className="divide-y"
        >
          {subjects.map(({ subject, tree }) => (
            <AccordionItem key={subject.id} value={subject.id ?? subject.name ?? ''} className="border-0 px-3">
              <AccordionTrigger className="py-3 text-left text-sm font-semibold hover:no-underline">
                {subject.long_name || subject.name || subject.short_name}
              </AccordionTrigger>
              <AccordionContent>
                {tree.length ? (
                  <ul className="space-y-1 pb-3">
                    {tree.map((node) => (
                      <TopicSelectorNode
                        key={node.id}
                        node={node}
                        selectedTopicId={selection.type === 'topic' ? selection.topicId : null}
                        onSelect={(selectedNode) => onSelectTopic(subject, selectedNode)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="pb-3 text-sm text-muted-foreground">No topics available.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </aside>
  );
}

export default function DueFlashcardsPage() {
  const { data: subjects = [], isLoading: subjectsLoading } = useResourceSubjects();
  const [selection, setSelection] = useState<Selection>({
    type: 'all',
    label: 'All due flashcards',
    topicIds: null,
  });

  const { data: subjectTopics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ['resources', 'flashcard-page-topic-hierarchy', subjects.map((subject) => subject.id).join(',')],
    queryFn: async () => {
      const rows = await Promise.all(
        subjects
          .filter((subject): subject is ResourceSubject & { id: string } => Boolean(subject.id))
          .map(async (subject) => ({
            subject,
            topics: await resourcesApi.getTopicsBySubject(subject.id),
          })),
      );
      return rows.map((item) => ({
        ...item,
        tree: buildTopicTree(item.topics),
      }));
    },
    enabled: subjects.length > 0,
  });

  const selectedTopicIds = selection.topicIds ?? undefined;
  const { data: cards, isLoading: cardsLoading } = useDueFlashcardReviewCards(selectedTopicIds);
  const isLoading = subjectsLoading || topicsLoading || cardsLoading;

  const totalTopics = useMemo(
    () => subjectTopics.reduce((count, subject) => count + subject.topics.length, 0),
    [subjectTopics],
  );

  return (
    <StudentPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: 'Flashcards' },
        ]}
      />

      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Flashcards</h1>
            <p className="mt-1 text-muted-foreground">
              {selection.label} · {cards?.length ?? 0} due now
            </p>
          </div>
          <Button type="button" onClick={() => setSelection({ type: 'all', label: 'All due flashcards', topicIds: null })}>
            Review All Due Cards
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <TopicHierarchyPanel
            subjects={subjectTopics}
            selection={selection}
            onSelectAll={() => setSelection({ type: 'all', label: 'All due flashcards', topicIds: null })}
            onSelectTopic={(subject, node) => {
              const topicIds = collectTopicIds(node);
              setSelection({
                type: 'topic',
                label: `${subject.short_name || subject.name || 'Subject'} · ${node.code}`,
                topicId: node.id,
                topicIds,
              });
            }}
          />

          <section className="min-w-0 space-y-4">
            {isLoading ? (
              <div className="h-64 rounded-2xl bg-muted/50" />
            ) : totalTopics === 0 ? (
              <div className="rounded-lg border bg-card p-6 text-center">
                <h2 className="text-xl font-semibold">No topics available</h2>
                <p className="mt-2 text-sm text-muted-foreground">Flashcards will appear here once topics are available.</p>
              </div>
            ) : (
              <FlashcardReviewSession
                key={selection.type === 'all' ? 'all' : selection.topicIds.join(',')}
                topicId={selection.type === 'all' ? 'due-all' : selection.topicIds[0]}
                mode="due"
                cards={cards ?? []}
                emptyDescription={
                  selection.type === 'all'
                    ? 'There are no due flashcards right now.'
                    : 'There are no due flashcards in this topic subtree right now.'
                }
              />
            )}
          </section>
        </div>
      </div>
    </StudentPageContainer>
  );
}
