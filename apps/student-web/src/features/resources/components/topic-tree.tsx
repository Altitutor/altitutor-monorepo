'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { ResourceTopicNode } from '../lib/types';

type TopicTreeProps = {
  nodes: ResourceTopicNode[];
  getHref: (topic: ResourceTopicNode) => string;
  className?: string;
};

function TopicTreeNode({ node, getHref }: { node: ResourceTopicNode; getHref: (topic: ResourceTopicNode) => string }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <li className="rounded-lg">
      <div className="flex items-center gap-1 py-0.5 pl-0 pr-1">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          disabled={!hasChildren}
          aria-label={expanded ? `Collapse ${node.code}` : `Expand ${node.code}`}
          aria-expanded={hasChildren ? expanded : undefined}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-300',
            hasChildren ? 'hover:bg-muted/80' : 'cursor-default opacity-0'
          )}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-300 ease-out', expanded && 'rotate-90')} />
        </button>

        <Link
          href={getHref(node)}
          className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors duration-300 hover:bg-muted/80"
        >
          <span className="block truncate">{node.code} · {node.name}</span>
        </Link>
      </div>

      {hasChildren ? (
        <div
          className={cn(
            'grid transition-all duration-300 ease-out',
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <div className="pl-3">
              <TopicTree nodes={node.children} getHref={getHref} />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function TopicTree({ nodes, getHref, className }: TopicTreeProps) {
  if (!nodes.length) {
    return <p className="text-sm text-muted-foreground">No topics available.</p>;
  }

  return (
    <ul className={cn('space-y-0', className)}>
      {nodes.map((node) => (
        <TopicTreeNode key={node.id} node={node} getHref={getHref} />
      ))}
    </ul>
  );
}
