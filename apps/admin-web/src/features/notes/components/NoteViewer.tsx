'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/shared/utils';

interface NoteViewerProps {
  content: string;
  className?: string;
}

/**
 * Component to render markdown content in view mode
 */
export function NoteViewer({ content, className }: NoteViewerProps) {
  if (!content) {
    return (
      <div className={cn('text-muted-foreground italic', className)}>
        No content yet. Click edit to add content.
      </div>
    );
  }

  return (
    <div className={cn('markdown-content', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-3xl font-bold mb-4 mt-6">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-bold mb-3 mt-5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-semibold mb-2 mt-4">{children}</h3>,
          p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="ml-4">{children}</li>,
          code: ({ children }) => (
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted p-4 rounded-md overflow-x-auto mb-4">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-muted-foreground pl-4 italic mb-4">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-primary underline hover:text-primary/80">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
