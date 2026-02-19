'use client';

import { parseTags, type TagEntityType } from '@/shared/utils/tagParsing';
import { cn } from '@/shared/utils';

interface TextWithTagsProps {
  text: string | null | undefined;
  className?: string;
  onTagClick?: (type: TagEntityType, id: string) => void;
}

export function TextWithTags({ text, className, onTagClick }: TextWithTagsProps) {
  if (!text) return null;

  const tags = parseTags(text);
  if (tags.length === 0) return <span className={className}>{text}</span>;

  // Build the rendered components
  const components: React.ReactNode[] = [];
  let lastIndex = 0;

  tags.forEach((tag, index) => {
    // Add text before tag
    if (tag.startIndex > lastIndex) {
      components.push(
        <span key={`text-${index}`}>
          {text.slice(lastIndex, tag.startIndex)}
        </span>
      );
    }

    // Unified styling for tag pills matching body styling
    const stylingClass = 'bg-primary/10 text-primary px-1 rounded-sm font-medium transition-colors whitespace-nowrap';

    // Add tag as pill
    components.push(
      <span
        key={`tag-${index}`}
        className={cn(
          'mx-0.5 px-1 py-0 text-[11px] inline-flex items-center rounded-sm',
          onTagClick && 'cursor-pointer hover:bg-primary/20',
          stylingClass
        )}
        onClick={(e) => {
          if (onTagClick) {
            e.stopPropagation();
            onTagClick(tag.type, tag.id);
          }
        }}
      >
        {tag.displayText}
      </span>
    );

    lastIndex = tag.endIndex;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    components.push(
      <span key="text-last">
        {text.slice(lastIndex)}
      </span>
    );
  }

  return <span className={cn('inline-flex items-center flex-wrap', className)}>{components}</span>;
}
