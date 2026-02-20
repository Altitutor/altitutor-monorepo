'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { UseFormReturn, Path, PathValue } from 'react-hook-form';
import {
  parseTags,
  createTagMarker,
  findMentionStart,
  extractMentionQuery,
  wouldBreakTag,
  getTagAtPosition,
  type TagEntityType,
} from '@/shared/utils/tagParsing';
import { getDayShortName } from '@/shared/utils/datetime';
import type { EntitySearchResult } from '@/shared/hooks/useEntitySearch';

/**
 * Converts HTML content from contentEditable to plain text with preserved line breaks
 * Handles both text nodes and tag markers properly
 */
function getTextWithLineBreaks(element: HTMLElement | null): string {
  // Guard: ensure element is a valid Node
  if (!element || !(element instanceof Node)) {
    return '';
  }
  
  // Extract text while reconstructing tag markers from rendered pills
  // Important: Skip text nodes that are inside mention-pill elements to avoid duplication
  let text = '';
  
  // Helper to check if a node is inside a mention-pill
  const isInsideMentionPill = (node: Node): boolean => {
    let current: Node | null = node;
    while (current && current !== element) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const el = current as HTMLElement;
        if (el.classList.contains('mention-pill')) {
          return true;
        }
      }
      current = current.parentNode;
    }
    return false;
  };
  
  // Process nodes recursively to handle line breaks and mention pills
  const processNode = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Skip text nodes that are inside mention-pill elements
      if (isInsideMentionPill(node)) {
        return; // Skip - this text is already included in the tag marker
      }
      // Remove zero-width spaces that we added after tag pills for cursor positioning
      const nodeText = node.textContent || '';
      text += nodeText.replace(/\u200B/g, '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains('mention-pill')) {
        const type = el.getAttribute('data-type');
        const id = el.getAttribute('data-id');
        const displayText = el.textContent || '';
        if (type && id) {
          // Reconstruct tag marker
          text += `@[${type}:${id}:${displayText}]`;
        }
      } else if (el.tagName === 'BR') {
        // Convert <br> tags to newline characters
        text += '\n';
      } else {
        // Process children of other elements
        // For block elements (div, p), add newlines between siblings
        const isBlockElement = el.tagName === 'DIV' || el.tagName === 'P';
        const children = el.childNodes;
        
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          // Add newline before block element content if it's not the first child
          if (isBlockElement && i > 0) {
            text += '\n';
          }
          processNode(child);
        }
        
        // Add newline after block element if it has a next sibling
        if (isBlockElement && el.nextSibling) {
          text += '\n';
        }
      }
    }
  };

  // Process all direct child nodes
  const children = element.childNodes;
  for (let i = 0; i < children.length; i++) {
    processNode(children[i]);
  }

  return text;
}

/**
 * Converts plain text with \n to HTML that contentEditable can display
 * Renders tags as pill elements with colored icons
 */
function setTextWithTags(element: HTMLElement | null, text: string, onTagClick?: (tag: { type: TagEntityType; id: string }) => void): void {
  if (!element || !(element instanceof Node)) {
    return;
  }
  if (!text) {
    element.innerHTML = '';
    return;
  }

  // Parse tags
  const tags = parseTags(text);
  
  // Build HTML with tags rendered as pills
  let html = '';
  let lastIndex = 0;

  tags.forEach((tag) => {
    // Add text before tag
    const beforeText = text.slice(lastIndex, tag.startIndex);
    if (beforeText) {
      html += escapeHtml(beforeText).replace(/\n/g, '<br>');
    }

    // Add tag as pill with unified styling
    const displayText = escapeHtml(tag.displayText);
    const stylingClass = 'bg-primary/10 text-primary px-1 rounded-sm font-medium cursor-pointer transition-colors hover:bg-primary/20';
    html += `<span class="mention-pill ${stylingClass}" data-type="${tag.type}" data-id="${tag.id}" contenteditable="false" data-mention="true">${displayText}</span>`;
    // Add a zero-width space after each pill to ensure cursor can be positioned after it
    html += '\u200B'; // Zero-width space

    lastIndex = tag.endIndex;
  });

  // Add remaining text
  const remainingText = text.slice(lastIndex);
  if (remainingText) {
    html += escapeHtml(remainingText).replace(/\n/g, '<br>');
  }

  element.innerHTML = html;

  // Attach click handlers to pills
  if (onTagClick) {
    element.querySelectorAll('.mention-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const type = pill.getAttribute('data-type') as TagEntityType;
        const id = pill.getAttribute('data-id');
        if (type && id) {
          onTagClick({ type, id });
        }
      });
    });
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

interface UseMentionFieldOptions<T extends object> {
  form: UseFormReturn<T>;
  fieldName: Path<T>;
  value?: string | null | undefined;
  onTagClick?: (tag: { type: TagEntityType; id: string }) => void;
  onEnter?: () => void;
}

export function useMentionField<T extends object>({
  form,
  fieldName,
  value,
  onTagClick,
  onEnter,
}: UseMentionFieldOptions<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);
  const mentionStartRef = useRef<number>(-1); // Store the position of @ when autocomplete opens
  const [mentionQuery, setMentionQuery] = useState<string>('');
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);

  // Sync contentEditable with form value
  useEffect(() => {
    if (ref.current && ref.current instanceof Node && !isUpdatingRef.current) {
      const formValue = form.getValues(fieldName) as string | null | undefined;
      const currentText = getTextWithLineBreaks(ref.current);
      const formText = formValue || '';

      if (currentText !== formText) {
        isUpdatingRef.current = true;
        setTextWithTags(ref.current, formText, onTagClick);
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 0);
      }
    }
  }, [form, fieldName, value, onTagClick]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const isClickingAutocomplete = relatedTarget?.closest('[class*="MentionAutocomplete"]') || relatedTarget?.closest('.fixed.z-\\[200\\]');
    
    // Don't close autocomplete if clicking on it
    if (isClickingAutocomplete) {
      // Restore focus to the contentEditable element
      setTimeout(() => {
        if (ref.current) {
          ref.current.focus();
        }
      }, 0);
      return;
    }
    
    // Only close autocomplete if focus is moving away
    // Use a small delay to check if focus returns (for autocomplete clicks)
    setTimeout(() => {
      // Check if element still has focus or if autocomplete is being interacted with
      if (document.activeElement === ref.current) {
        return; // Focus returned, don't close
      }
      
      // Check if there's still a mention being typed
      const target = e.currentTarget;
      if (!target || !(target instanceof Node)) {
        setIsMentionOpen(false);
        mentionStartRef.current = -1;
        return;
      }
      const text = getTextWithLineBreaks(target);
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const cursorPosition = range ? getCursorPositionInText(target, range) : -1;
      
      if (cursorPosition >= 0) {
        const mentionStart = findMentionStart(text, cursorPosition);
        if (mentionStart >= 0) {
          // Still typing a mention, don't close
          return;
        }
      }
      
      form.setValue(fieldName, text as PathValue<T, Path<T>>);
      setIsMentionOpen(false);
      mentionStartRef.current = -1; // Reset stored position
    }, 100);
  }, [form, fieldName]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isUpdatingRef.current) return;

    const element = e.currentTarget;
    if (!element || !(element instanceof Node)) return;
    
    // Get cursor position first, before we modify anything
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const cursorPosition = range ? getCursorPositionInText(element, range) : -1;
    
    // Get text after getting cursor position
    const text = getTextWithLineBreaks(element);

    // Check if editing would break a tag
    if (cursorPosition >= 0 && wouldBreakTag(text, cursorPosition)) {
      // Remove the tag that was broken
      const tag = getTagAtPosition(text, cursorPosition);
      if (tag) {
        const newText = text.slice(0, tag.startIndex) + text.slice(tag.endIndex);
        isUpdatingRef.current = true;
        setTextWithTags(element, newText, onTagClick);
        form.setValue(fieldName, newText as PathValue<T, Path<T>>);
        
        // Restore cursor position
        setTimeout(() => {
          const newPosition = tag.startIndex;
          setCursorPosition(element, newPosition);
          isUpdatingRef.current = false;
        }, 0);
        return;
      }
    }

    // Check for @ mention
    if (cursorPosition >= 0) {
      const mentionStart = findMentionStart(text, cursorPosition);
      if (mentionStart >= 0) {
        const query = extractMentionQuery(text, cursorPosition);
        // Show autocomplete immediately when @ is typed, even with empty query
        if (query !== null) {
          // Store the mention start position for later use when inserting tag
          mentionStartRef.current = mentionStart;
          
          // Use requestAnimationFrame to ensure DOM is updated, but don't delay too much
          requestAnimationFrame(() => {
            setMentionQuery(query);
            setIsMentionOpen(true);
            
            // Calculate position for autocomplete at current cursor position
            // Use the actual selection range for accurate positioning
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0).cloneRange();
              // Collapse range to end to get the actual cursor position (where text is being typed)
              range.collapse(false);
              const rect = range.getBoundingClientRect();
              // Use viewport coordinates directly (getBoundingClientRect returns viewport coordinates)
              // If rect has no width/height, use a default height
              const height = rect.height || 20;
              // Position dropdown with top-left corner at bottom-left of cursor
              setMentionPosition({
                top: rect.top + height + 4,
                left: rect.left,
              });
            } else {
              // Fallback to text position calculation
              const rect = getCaretPosition(element, cursorPosition);
              if (rect) {
                setMentionPosition({
                  top: rect.top + rect.height + 4,
                  left: rect.left,
                });
              }
            }
          });
        } else {
          // Query is null but mentionStart was found - this shouldn't happen, but close anyway
          setIsMentionOpen(false);
          mentionStartRef.current = -1;
        }
      } else {
        // No mention start found - close autocomplete
        setIsMentionOpen(false);
        mentionStartRef.current = -1;
      }
    } else {
      // No valid cursor position - close autocomplete
      setIsMentionOpen(false);
      mentionStartRef.current = -1;
    }

    form.setValue(fieldName, text as PathValue<T, Path<T>>, { shouldValidate: true });
  }, [form, fieldName, onTagClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Don't interfere with mention autocomplete navigation
    if (isMentionOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
      return; // Let MentionAutocomplete handle these
    }

    // Handle Enter key for single-line title/name fields - prevent newline and move focus
    if (e.key === 'Enter' && (fieldName === 'title' || fieldName === 'name') && onEnter) {
      e.preventDefault();
      onEnter();
      return;
    }

    // Prevent breaking tags
    if (ref.current && ref.current instanceof Node) {
      const text = getTextWithLineBreaks(ref.current);
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const cursorPosition = range ? getCursorPositionInText(ref.current, range) : -1;

      if (cursorPosition >= 0 && wouldBreakTag(text, cursorPosition)) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          const tag = getTagAtPosition(text, cursorPosition);
          if (tag) {
            const newText = text.slice(0, tag.startIndex) + text.slice(tag.endIndex);
            isUpdatingRef.current = true;
            setTextWithTags(ref.current, newText, onTagClick);
            form.setValue(fieldName, newText as PathValue<T, Path<T>>);
            
            setTimeout(() => {
              const newPosition = tag.startIndex;
              setCursorPosition(ref.current!, newPosition);
              isUpdatingRef.current = false;
            }, 0);
          }
        }
      }
    }
  }, [form, fieldName, isMentionOpen, onTagClick, onEnter]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    if (!element || !(element instanceof Node)) return;

    e.preventDefault();

    const pastedText = e.clipboardData.getData('text/plain');
    if (!pastedText) return;

    const currentText = getTextWithLineBreaks(element);
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const cursorPosition = range ? getCursorPositionInText(element, range) : currentText.length;

    const newText =
      currentText.slice(0, cursorPosition) +
      pastedText +
      currentText.slice(cursorPosition);
    const newCursorPosition = cursorPosition + pastedText.length;

    isUpdatingRef.current = true;
    setTextWithTags(element, newText, onTagClick);
    form.setValue(fieldName, newText as PathValue<T, Path<T>>, { shouldValidate: true });

    setCursorPosition(element, newCursorPosition);
    setIsMentionOpen(false);
    mentionStartRef.current = -1;
    isUpdatingRef.current = false;
  }, [fieldName, form, onTagClick]);

  const insertTag = useCallback((result: EntitySearchResult) => {
    if (!ref.current) {
      return;
    }

    const element = ref.current;
    if (!element || !(element instanceof Node)) {
      return;
    }
    
    // Ensure element has focus before inserting tag
    if (document.activeElement !== element) {
      element.focus();
    }
    
    const text = getTextWithLineBreaks(element);
    
    // Use stored mention start position if available, otherwise try to find it
    let mentionStart = mentionStartRef.current;
    
    if (mentionStart < 0) {
      // Fallback: try to get cursor position and find mention
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      let cursorPosition = -1;
      
      if (range) {
        cursorPosition = getCursorPositionInText(element, range);
      }
      
      // If we can't get cursor position, try to find the @ mention in the text
      if (cursorPosition < 0) {
        // Fallback: find the last @ in the text that's not part of a tag
        const lastAt = text.lastIndexOf('@');
        if (lastAt >= 0) {
          // Check if it's part of a tag marker
          const afterAt = text.slice(lastAt);
          if (!afterAt.match(/^@\[/)) {
            cursorPosition = lastAt + 1; // Position after @
          }
        }
      }

      if (cursorPosition < 0) {
        setIsMentionOpen(false);
        mentionStartRef.current = -1;
        return;
      }

      mentionStart = findMentionStart(text, cursorPosition);
      if (mentionStart < 0) {
        setIsMentionOpen(false);
        mentionStartRef.current = -1;
        return;
      }
    }
    
    // Find the end of the mention query (where to insert the tag)
    // Look for the end of the current mention by finding the next space, newline, or end of text
    let mentionEnd = mentionStart + 1; // Start after @
    while (mentionEnd < text.length) {
      const char = text[mentionEnd];
      if (char === ' ' || char === '\n' || char === '@') {
        break;
      }
      // If we hit a tag marker, stop
      if (text.slice(mentionEnd).startsWith('@[')) {
        break;
      }
      mentionEnd++;
    }
    
    const cursorPosition = mentionEnd;

    // Get display text
    let displayText = '';
    if (result.type === 'student') {
      displayText = [result.data.first_name, result.data.last_name].filter(Boolean).join(' ').trim() || `Student ${result.id.slice(0, 8)}`;
    } else if (result.type === 'staff') {
      displayText = [result.data.first_name, result.data.last_name].filter(Boolean).join(' ').trim();
    } else if (result.type === 'parent') {
      displayText = [result.data.first_name, result.data.last_name].filter(Boolean).join(' ').trim();
    } else if (result.type === 'class') {
      const classData = result.data;
      const subject = classData.subject;
      // day_of_week is a number (0-6), convert to day name using utility
      const dayAbbr = typeof classData.day_of_week === 'number' ? getDayShortName(classData.day_of_week) : '';
      const time = classData.start_time || '';
      const subjectName = subject?.short_name || subject?.long_name || '';
      displayText = `${subjectName} ${dayAbbr} ${time}`.trim();
    } else if (result.type === 'subject') {
      displayText = result.data.long_name || result.data.short_name || result.data.name || '';
    } else if (result.type === 'task') {
      displayText = result.data.title || '';
    } else if (result.type === 'issue') {
      displayText = result.data.name || '';
    } else if (result.type === 'project') {
      displayText = result.data.name || '';
    } else if (result.type === 'topic') {
      displayText = result.data.name || '';
    } else if (result.type === 'file') {
      const fileData = result.data;
      const subjectShortName = fileData.subject.short_name || '';
      const fileCode = fileData.code ? ` ${fileData.code}` : '';
      const topicName = fileData.topic.name || '';
      displayText = `${subjectShortName}${fileCode} ${topicName}`.trim();
    }

    // Create tag marker
    const tagMarker = createTagMarker(result.type as TagEntityType, result.id, displayText);

    // Replace mention with tag
    const newText = text.slice(0, mentionStart) + tagMarker + text.slice(cursorPosition);
    
    isUpdatingRef.current = true;
    setTextWithTags(element, newText, onTagClick);
    form.setValue(fieldName, newText as PathValue<T, Path<T>>);
    
    // Set cursor after tag - use double requestAnimationFrame to ensure DOM is fully updated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newPosition = mentionStart + tagMarker.length;
        setCursorPosition(element, newPosition);
        
        // Ensure cursor is visible by scrolling if needed
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.getBoundingClientRect(); // Force layout calculation
          // Scroll the element into view if cursor is not visible
          const rect = range.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          if (rect.top < elementRect.top || rect.bottom > elementRect.bottom) {
            range.startContainer.parentElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
        
        setIsMentionOpen(false);
        mentionStartRef.current = -1; // Reset stored position
        isUpdatingRef.current = false;
      });
    });
  }, [form, fieldName, onTagClick]);

  return {
    ref,
    handleBlur,
    handleInput,
    handleKeyDown,
    handlePaste,
    mentionQuery,
    mentionPosition,
    isMentionOpen,
    insertTag,
    closeMention: () => {
      setIsMentionOpen(false);
      mentionStartRef.current = -1; // Reset stored position
    },
  };
}

// Helper functions for cursor position
function getCursorPositionInText(element: HTMLElement, range: Range): number {
  // Create a range that spans from the start of the element to the cursor
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  
  // Get the text content, handling tag pills correctly
  const container = document.createDocumentFragment();
  const clonedRange = preCaretRange.cloneContents();
  container.appendChild(clonedRange);
  
  // Helper to check if a node is inside a mention-pill
  const isInsideMentionPill = (node: Node): boolean => {
    let current: Node | null = node;
    while (current && current !== container) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const el = current as HTMLElement;
        if (el.classList.contains('mention-pill')) {
          return true;
        }
      }
      current = current.parentNode;
    }
    return false;
  };
  
  // Convert to text, reconstructing tag markers
  let text = '';
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Skip text nodes that are inside mention-pill elements
      if (isInsideMentionPill(node)) {
        continue; // Skip - this text is already included in the tag marker
      }
      // Remove zero-width spaces that we added after tag pills for cursor positioning
      const nodeText = node.textContent || '';
      text += nodeText.replace(/\u200B/g, '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains('mention-pill')) {
        const type = el.getAttribute('data-type');
        const id = el.getAttribute('data-id');
        const displayText = el.textContent || '';
        if (type && id) {
          text += `@[${type}:${id}:${displayText}]`;
        }
      } else {
        // For other elements, get their text content (but skip if inside mention-pill)
        if (!isInsideMentionPill(el)) {
          // Remove zero-width spaces from element text content
          const elText = el.textContent || '';
          text += elText.replace(/\u200B/g, '');
        }
      }
    }
  }
  
  return text.length;
}

function setCursorPosition(element: HTMLElement, position: number): void {
  const selection = window.getSelection();
  if (!selection) return;

  // Helper to check if a node is inside a mention-pill
  const isInsideMentionPill = (node: Node): boolean => {
    let current: Node | null = node;
    while (current && current !== element) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const el = current as HTMLElement;
        if (el.classList.contains('mention-pill')) {
          return true;
        }
      }
      current = current.parentNode;
    }
    return false;
  };

  const range = document.createRange();
  let currentPos = 0;
  const nodeStack: Node[] = [element];
  let node: Node | undefined;
  let foundStart = false;

  while (!foundStart && (node = nodeStack.pop())) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Skip text nodes inside mention-pill elements (they're part of the tag marker)
      if (isInsideMentionPill(node)) {
        continue;
      }
      // Count text length excluding zero-width spaces
      const nodeText = node.textContent || '';
      const textLength = nodeText.replace(/\u200B/g, '').length;
      const nextPos = currentPos + textLength;
      if (position <= nextPos) {
        // Position is in this text node
        // Calculate offset accounting for zero-width spaces
        const offset = position - currentPos;
        // Adjust offset to account for zero-width spaces before this position
        let actualOffset = 0;
        let counted = 0;
        for (let i = 0; i < nodeText.length && counted < offset; i++) {
          if (nodeText[i] !== '\u200B') {
            counted++;
          }
          actualOffset++;
        }
        range.setStart(node, actualOffset);
        range.setEnd(node, actualOffset);
        foundStart = true;
      }
      currentPos = nextPos;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains('mention-pill')) {
        // This is a tag pill - count it as the tag marker length
        const type = el.getAttribute('data-type');
        const id = el.getAttribute('data-id');
        const displayText = el.textContent || '';
        if (type && id) {
          const tagMarker = `@[${type}:${id}:${displayText}]`;
          const tagMarkerLength = tagMarker.length;
          const nextPos = currentPos + tagMarkerLength;
          
          if (position <= nextPos) {
            // Position is inside or at the end of this tag marker - place cursor after the pill
            const nextSibling = el.nextSibling;
            if (nextSibling) {
              if (nextSibling.nodeType === Node.TEXT_NODE) {
                range.setStart(nextSibling, 0);
                range.setEnd(nextSibling, 0);
              } else {
                range.setStartBefore(nextSibling);
                range.setEndBefore(nextSibling);
              }
            } else {
              // No next sibling, set after the pill
              range.setStartAfter(el);
              range.setEndAfter(el);
            }
            foundStart = true;
          }
          currentPos = nextPos;
        }
        // Don't process children of mention-pill
        continue;
      } else {
        // Regular element - process its children
        const children = node.childNodes;
        for (let i = children.length - 1; i >= 0; i--) {
          nodeStack.push(children[i]);
        }
      }
    }
  }

  if (foundStart) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function getCaretPosition(element: HTMLElement, textPosition: number): { top: number; left: number; height: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    // If no selection, try to create a range at the text position
    const range = document.createRange();
    let currentPos = 0;
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      // Count text length excluding zero-width spaces
      const nodeText = node.textContent || '';
      const textLength = nodeText.replace(/\u200B/g, '').length;
      if (currentPos + textLength >= textPosition) {
        // Calculate offset accounting for zero-width spaces
        const offset = textPosition - currentPos;
        let actualOffset = 0;
        let counted = 0;
        for (let i = 0; i < nodeText.length && counted < offset; i++) {
          if (nodeText[i] !== '\u200B') {
            counted++;
          }
          actualOffset++;
        }
        range.setStart(node, Math.min(actualOffset, nodeText.length));
        range.setEnd(node, Math.min(actualOffset, nodeText.length));
        break;
      }
      currentPos += textLength;
    }

    // Collapse range to ensure we get cursor position
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      height: rect.height || 20, // Default height if rect is empty
    };
  }

  // Use current selection position
  const range = selection.getRangeAt(0).cloneRange();
  // Collapse to end to get the actual cursor position (where text is being typed)
  range.collapse(false);
  const rect = range.getBoundingClientRect();
  
  return {
    top: rect.top,
    left: rect.left,
    height: rect.height || 20,
  };
}
