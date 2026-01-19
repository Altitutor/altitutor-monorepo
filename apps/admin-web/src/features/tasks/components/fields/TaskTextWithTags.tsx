'use client';

import { parseTags, type TagEntityType } from '../../utils/tagParsing';
import { TagPill } from './TagPill';

interface TaskTextWithTagsProps {
  text: string | null | undefined;
  className?: string;
  onTagClick?: (type: TagEntityType, id: string) => void;
}

/**
 * Renders task text with tags displayed as pills
 * Used in tasks table and task cards
 */
export function TaskTextWithTags({ text, className, onTagClick }: TaskTextWithTagsProps) {
  if (!text) return null;

  const tags = parseTags(text);
  
  // If no tags, just render plain text
  if (tags.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Build array of text segments and tag pills
  const parts: Array<{ type: 'text' | 'tag'; content: string; tag?: { type: TagEntityType; id: string; displayText: string } }> = [];
  let lastIndex = 0;

  tags.forEach((tag) => {
    // Add text before tag
    if (tag.startIndex > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, tag.startIndex),
      });
    }

    // Add tag
    parts.push({
      type: 'tag',
      content: tag.displayText,
      tag: {
        type: tag.type,
        id: tag.id,
        displayText: tag.displayText,
      },
    });

    lastIndex = tag.endIndex;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'tag' && part.tag) {
          return (
            <TagPill
              key={`tag-${index}-${part.tag.id}`}
              type={part.tag.type}
              displayText={part.tag.displayText}
              onClick={onTagClick ? () => onTagClick(part.tag!.type, part.tag!.id) : undefined}
              className="mx-0.5"
            />
          );
        }
        return <span key={`text-${index}`}>{part.content}</span>;
      })}
    </span>
  );
}
