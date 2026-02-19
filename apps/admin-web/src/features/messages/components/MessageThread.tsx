'use client';

import { useEffect, useRef, useMemo, useState, useLayoutEffect } from 'react';
import { useMessagesForContact, useContactHeader } from '../api/queries';
import { useMarkRead } from '../api/mutations';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatMessageDate, formatMessageStatus, formatDaySeparator, isDifferentDay } from '../utils/formatDate';
import { StaffAvatar } from './StaffAvatar';
import { X, File, Download, Music, Play, Pause, AlertTriangle } from 'lucide-react';
import { Input, Button, Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, type JSONContent } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { messagesKeys } from '../api/queryKeys';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CreateIssueDialog } from '@/features/issues/components/CreateIssueDialog';
import { EditIssueDialog } from '@/features/issues/components/EditIssueDialog';
import { useIssues } from '@/features/issues/api/queries';
import { issuesApi } from '@/features/issues/api/issues';
import type { IssueTagInsert, IssueWithTags, IssueUpdate } from '@/features/issues/types';
import { extractMentions } from '@/shared/utils/extractMentions';
import { TextWithTags } from '@/shared/components/TextWithTags';

type IssueTagDraft = Omit<IssueTagInsert, 'issue_id'>;

function getTagKey(tag: Partial<IssueTagInsert>) {
  if (tag.student_id) return `student:${tag.student_id}`;
  if (tag.staff_id) return `staff:${tag.staff_id}`;
  if (tag.parent_id) return `parent:${tag.parent_id}`;
  if (tag.class_id) return `class:${tag.class_id}`;
  if (tag.session_id) return `session:${tag.session_id}`;
  if (tag.invoice_id) return `invoice:${tag.invoice_id}`;
  if (tag.subject_id) return `subject:${tag.subject_id}`;
  return null;
}

function toMentionData(tag: Partial<IssueTagInsert>): { type: string; id: string; label: string } | null {
  if (tag.student_id) return { type: 'student', id: tag.student_id, label: tag.student_id };
  if (tag.staff_id) return { type: 'staff', id: tag.staff_id, label: tag.staff_id };
  if (tag.parent_id) return { type: 'parent', id: tag.parent_id, label: tag.parent_id };
  if (tag.class_id) return { type: 'class', id: tag.class_id, label: tag.class_id };
  if (tag.session_id) return { type: 'session', id: tag.session_id, label: tag.session_id };
  if (tag.invoice_id) return { type: 'invoice', id: tag.invoice_id, label: tag.invoice_id };
  if (tag.subject_id) return { type: 'subject', id: tag.subject_id, label: tag.subject_id };
  return null;
}

function issueTagToDraft(tag: IssueWithTags['tags'][number]): IssueTagDraft | null {
  if (tag.student_id) return { student_id: tag.student_id };
  if (tag.staff_id) return { staff_id: tag.staff_id };
  if (tag.parent_id) return { parent_id: tag.parent_id };
  if (tag.class_id) return { class_id: tag.class_id };
  if (tag.session_id) return { session_id: tag.session_id };
  if (tag.invoice_id) return { invoice_id: tag.invoice_id };
  if (tag.subject_id) return { subject_id: tag.subject_id };
  return null;
}

interface Props {
  contactId: string;
  isSearching?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;
  onExitSearch?: () => void;
  hideAddIssueHover?: boolean;
}

interface AttachmentProps {
  attachment: Tables<'message_attachments'>;
  direction: 'INBOUND' | 'OUTBOUND';
}

export function MessageAttachment({ attachment }: AttachmentProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Check if it's a PDF
  const filenameLower = attachment.filename?.toLowerCase() || '';
  const isPdf = attachment.mime_type === 'application/pdf' || filenameLower.endsWith('.pdf');
  const isAudioByMime = attachment.mime_type?.startsWith('audio/');
  const isAudioByExtension = filenameLower.endsWith('.mp3') ||
                             filenameLower.endsWith('.wav') ||
                             filenameLower.endsWith('.m4a') ||
                             filenameLower.endsWith('.aac') ||
                             filenameLower.endsWith('.aiff') ||
                             filenameLower.endsWith('.caf') ||
                             filenameLower.endsWith('.ogg') ||
                             filenameLower.endsWith('.flac');
  const isAudio = isAudioByMime || isAudioByExtension;
  
  // Format time helper for audio player
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle audio time updates
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  
  // Handle audio metadata load
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };
  
  // Handle seekbar change
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };
  
  // Handle play/pause
  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };
  
  // Handle audio ended
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Get file extension for display
  const getFileExtension = (filename: string | null | undefined): string => {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
  };

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  // Generate signed URL for private bucket
  useEffect(() => {
    const storageUrl = attachment.storage_url;
    
    // Skip invalid local:// URLs
    if (storageUrl?.startsWith('local://')) {
      setUrlError(true);
      return;
    }
    
    // If it's already a full URL, we still need to check if it's a signed URL or old public URL
    if (storageUrl?.startsWith('http')) {
      // If it's a signed URL, use it directly. Otherwise, extract path and regenerate
      if (storageUrl.includes('/sign/')) {
        setSignedUrl(storageUrl);
        return;
      }
      // Old public URL - extract path and regenerate as signed URL
      const supabaseUrlMatch = storageUrl.match(/\/storage\/v1\/object\/[^/]+\/messages-media\/(.+)$/);
      if (supabaseUrlMatch) {
        const filePath = supabaseUrlMatch[1];
        const supabase = getSupabaseClient();
        supabase.storage
          .from('messages-media')
          .createSignedUrl(filePath, 3600)
          .then(({ data, error }) => {
            if (error) {
              console.error('Failed to create signed URL:', error);
              setUrlError(true);
            } else {
              setSignedUrl(data.signedUrl);
            }
          })
          .catch((err) => {
            console.error('Error creating signed URL:', err);
            setUrlError(true);
          });
        return;
      }
    }
    
    // Extract path from storage_url (could be full URL or just path)
    let filePath = storageUrl;
    if (!filePath) {
      setUrlError(true);
      return;
    }
    
    // If it's a full Supabase URL, extract the path
    const supabaseUrlMatch = filePath.match(/\/storage\/v1\/object\/[^/]+\/messages-media\/(.+)$/);
    if (supabaseUrlMatch) {
      filePath = supabaseUrlMatch[1];
    }
    
    // Generate signed URL (valid for 1 hour)
    const supabase = getSupabaseClient();
    supabase.storage
      .from('messages-media')
      .createSignedUrl(filePath, 3600)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to create signed URL:', error);
          setUrlError(true);
        } else {
          setSignedUrl(data.signedUrl);
        }
      })
      .catch((err) => {
        console.error('Error creating signed URL:', err);
        setUrlError(true);
    });
  }, [attachment.storage_url]);
  
  // Show error state if URL generation failed
  if (urlError) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-dashed max-w-[200px]">
        <File className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground truncate" title={attachment.filename || 'Attachment'}>
          {attachment.filename || 'Attachment'} (not available)
        </span>
      </div>
    );
  }
  
  // Show loading state while generating signed URL
  if (!signedUrl) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg max-w-[200px]">
        <File className="h-4 w-4 text-muted-foreground animate-pulse shrink-0" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const attachmentUrl = signedUrl;

  // Download handler
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(attachmentUrl!);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename || 'attachment';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: unknown) {
      console.error('Failed to download attachment:', error);
      // Fallback: open in new tab
      window.open(attachmentUrl!, '_blank');
    }
  };
  
  // For audio files: show inline audio player
  if (isAudio) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2 bg-muted border border-border/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs truncate flex-1 min-w-0">
            {attachment.filename || 'Audio'}
          </span>
          <button
            onClick={handleDownload}
            className="p-1 hover:bg-muted-foreground/20 rounded transition-colors"
            aria-label="Download audio"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
        <audio
          ref={audioRef}
          src={attachmentUrl}
          className="hidden"
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
        >
          Your browser does not support the audio element.
        </audio>
        <div className="flex items-center gap-2">
          {/* Play/Pause button */}
          <button
            onClick={handlePlayPause}
            className="p-1.5 hover:bg-muted-foreground/20 rounded transition-colors shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
          {/* Seekbar and timestamps */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {/* Seekbar */}
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${duration ? (currentTime / duration) * 100 : 0}%, hsl(var(--muted)) ${duration ? (currentTime / duration) * 100 : 0}%, hsl(var(--muted)) 100%)`
              }}
            />
            {/* Timestamps */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // For files (including HEIC and failed images): show file card
  const fileExtension = getFileExtension(attachment.filename);
  const fileSize = formatFileSize(attachment.size_bytes);
  const hasFileInfo = fileExtension || fileSize;

  return (
    <div className="flex flex-col gap-1 px-3 py-2 bg-muted border border-border/50 rounded-lg hover:bg-muted/80 transition-colors group max-w-[200px]">
      <div className="flex items-center gap-2">
        <a
          href={attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {isPdf ? (
            <File className="h-4 w-4 shrink-0" />
          ) : (
            <File className="h-4 w-4 shrink-0" />
          )}
          <span className="text-xs font-medium truncate" title={attachment.filename || 'Attachment'}>
            {attachment.filename || 'Attachment'}
          </span>
        </a>
        <button
          onClick={handleDownload}
          className="p-1 hover:bg-muted-foreground/20 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          aria-label="Download file"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      {hasFileInfo && (
        <div className="text-[10px] text-muted-foreground">
          {fileExtension && <span className="font-medium">{fileExtension}</span>}
          {fileExtension && fileSize && ' • '}
          {fileSize}
        </div>
      )}
    </div>
  );
}

export function MessageThread({ contactId, isSearching = false, searchTerm = '', onSearchTermChange, onExitSearch, hideAddIssueHover = false }: Props) {
  const { data, fetchNextPage, hasNextPage } = useMessagesForContact(contactId);
  const markRead = useMarkRead();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const lastRenderedContactIdRef = useRef<string | null>(null);
  const prevContactId = useRef(contactId);
  const lastMarkedMessageId = useRef<string | null>(null);
  const markReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [isEditIssueOpen, setIsEditIssueOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isIssueActionLoading, setIsIssueActionLoading] = useState(false);
  
  // Reset initial load flag when contact changes
  useEffect(() => {
    if (prevContactId.current !== contactId) {
      prevContactId.current = contactId;
      lastMarkedMessageId.current = null; // Reset when contact changes
      shouldStickToBottomRef.current = true;
      // Cancel any pending markRead calls
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    }
  }, [contactId]);

  useEffect(() => {
    if (!contactId) return;
    
    // Get all conversation IDs for this contact to subscribe to all of them
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    // Fetch conversation IDs for this contact
    supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .in('status', ['OPEN', 'SNOOZED'])
      .then(({ data: conversations }) => {
        if (!conversations || conversations.length === 0) return;
        
        const conversationIds = conversations.map((c) => {
          if (!c || typeof c !== 'object' || !('id' in c)) return '';
          return String(c.id);
        }).filter((id): id is string => id !== '');
        
        // Subscribe to messages from all conversations for this contact
        const channel = supabase
          .channel(`messages-contact-${contactId}`)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=in.(${conversationIds.join(',')})`
          }, () => {
            // Invalidate to refetch all messages for this contact
            qc.invalidateQueries({ queryKey: messagesKeys.messagesForContact(contactId) });
          })
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=in.(${conversationIds.join(',')})`
          }, () => {
            qc.invalidateQueries({ queryKey: messagesKeys.messagesForContact(contactId) });
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'conversations',
            filter: `contact_id=eq.${contactId}`
          }, () => {
            qc.invalidateQueries({ queryKey: messagesKeys.messagesForContact(contactId) });
          })
          .subscribe();
        
        return () => {
          supabase.removeChannel(channel);
        };
      });
  }, [contactId, qc]);

  // Mark conversation as read - debounced and only when last message changes
  useEffect(() => {
    const last = data?.pages?.flatMap(p => p.items)?.[0];
    const lastMessageId = last?.id;
    const currentContactId = contactId; // Capture for closure
    
    // Only mark as read if:
    // 1. We have a last message ID
    // 2. It's different from what we last marked
    if (lastMessageId && lastMessageId !== lastMarkedMessageId.current) {
      // Cancel any pending markRead calls
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
      }
      
      // Debounce markRead to avoid excessive calls when switching contacts quickly
      markReadTimeoutRef.current = setTimeout(() => {
        // Double-check we're still on the same contact
        if (prevContactId.current === currentContactId) {
          markRead.mutate({ contactId: currentContactId, lastMessageId });
          lastMarkedMessageId.current = lastMessageId;
        }
        markReadTimeoutRef.current = null;
      }, 500); // 500ms debounce
    }
    
    // Cleanup timeout on unmount or contact change
    return () => {
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    };
  }, [data, contactId, markRead]);

  // Filter and process messages for search
  const processedMessages = useMemo(() => {
    if (!data?.pages) return [];
    const items = data.pages.flatMap(p => p.items);
    
    type MessageItem = typeof items[number];
    type ProcessedMessageItem = 
      | (MessageItem & { type: 'message'; searchTerm?: string })
      | { type: 'separator'; count: number; id: string };
    
    if (!isSearching || !searchTerm.trim()) {
      // When not searching, return items with type 'message' - newest first for column-reverse
      return items.map((m) => ({ ...m, type: 'message' as const })) as ProcessedMessageItem[];
    }
    
    const search = searchTerm.toLowerCase();
    const itemsToFilter = items;
    const filtered: ProcessedMessageItem[] = [];
    let hiddenCount = 0;
    
    itemsToFilter.forEach((m, index) => {
      const matches = m.body.toLowerCase().includes(search);
      
      if (matches) {
        // Add separator for hidden messages before this one
        if (hiddenCount > 0) {
          filtered.push({ type: 'separator', count: hiddenCount, id: `sep-${index}` });
          hiddenCount = 0;
        }
        filtered.push({ ...m, type: 'message', searchTerm });
      } else {
        hiddenCount++;
      }
    });
    
    // Add final separator if needed
    if (hiddenCount > 0) {
      filtered.push({ type: 'separator', count: hiddenCount, id: `sep-end` });
    }
    
    return filtered;
  }, [data, isSearching, searchTerm]);

  // Render oldest -> newest so native wheel direction behaves normally.
  const renderedMessages = useMemo(() => [...processedMessages].reverse(), [processedMessages]);

  // Keep viewport pinned to bottom on initial contact load and while user stays near bottom.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const isContactSwitch = lastRenderedContactIdRef.current !== contactId;
    if (isContactSwitch || shouldStickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }

    lastRenderedContactIdRef.current = contactId;
  }, [contactId, renderedMessages.length]);

  // Keep pinned to bottom while dynamic content (attachments, images, etc.) settles.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (!shouldStickToBottomRef.current) return;
      const target = scrollRef.current;
      if (!target) return;
      requestAnimationFrame(() => {
        target.scrollTop = target.scrollHeight;
      });
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [contactId]);

  // Highlight search term in message body
  const highlightText = (text: string, term: string) => {
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <span key={i} className="bg-yellow-200 dark:bg-yellow-600">{part}</span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const { data: contact } = useContactHeader(contactId);
  const { data: candidateIssues = [] } = useIssues({ status: ['open', 'awaiting_response'] });

  const contactIssueTags = useMemo<IssueTagDraft[]>(() => {
    const tags: IssueTagDraft[] = [];
    if (contact?.students?.id) tags.push({ student_id: contact.students.id });
    if (contact?.parents?.id) tags.push({ parent_id: contact.parents.id });
    if (contact?.staff?.id) tags.push({ staff_id: contact.staff.id });

    const seen = new Set<string>();
    return tags.filter((tag) => {
      const key = getTagKey(tag);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [contact?.parents?.id, contact?.staff?.id, contact?.students?.id]);

  const matchedIssues = useMemo(() => {
    const wantedKeys = new Set(
      contactIssueTags.map((tag) => getTagKey(tag)).filter(Boolean) as string[]
    );
    if (wantedKeys.size === 0) return [] as IssueWithTags[];

    return candidateIssues.filter((issue) =>
      issue.tags.some((tag) => {
        const key = getTagKey(tag);
        return !!key && wantedKeys.has(key);
      })
    );
  }, [candidateIssues, contactIssueTags]);

  const appendTagsToIssueDescription = async (issue: IssueWithTags) => {
    const existingIssueTags = issue.tags
      .map(issueTagToDraft)
      .filter((tag): tag is IssueTagDraft => !!tag);
    const allTags = [...existingIssueTags, ...contactIssueTags].filter((tag, index, arr) => {
      const key = getTagKey(tag);
      if (!key) return false;
      return arr.findIndex((candidate) => getTagKey(candidate) === key) === index;
    });

    const currentDescription = issue.description as JSONContent | null;
    const currentDoc: JSONContent =
      currentDescription && currentDescription.type === 'doc'
        ? currentDescription
        : { type: 'doc', content: [] };

    const existingMentionKeys = new Set(
      extractMentions(currentDoc).map((mention) => `${mention.type}:${mention.id}`)
    );

    const mentionParagraphs: JSONContent[] = [];
    allTags.forEach((tag) => {
      const mention = toMentionData(tag);
      if (!mention) return;

      const key = `${mention.type}:${mention.id}`;
      if (existingMentionKeys.has(key)) return;

      existingMentionKeys.add(key);
      mentionParagraphs.push({
        type: 'paragraph',
        content: [
          {
            type: 'mention',
            attrs: {
              id: mention.id,
              type: mention.type,
              label: mention.label,
            },
          },
          { type: 'text', text: ' ' },
        ],
      });
    });

    if (mentionParagraphs.length === 0) return;

    const updatedDescription: JSONContent = {
      ...currentDoc,
      content: [...(currentDoc.content || []), ...mentionParagraphs],
    };

    await issuesApi.update(issue.id, { description: updatedDescription as IssueUpdate['description'] });
  };

  const handleCreateIssue = () => {
    setIsCreateIssueOpen(true);
  };

  const handleAddToIssue = async (issue: IssueWithTags) => {
    try {
      setIsIssueActionLoading(true);
      await appendTagsToIssueDescription(issue);
      setSelectedIssueId(issue.id);
      setIsEditIssueOpen(true);
    } catch (error) {
      console.error('Failed to add to issue:', error);
    } finally {
      setIsIssueActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Search bar */}
      {isSearching && (
        <div className="p-3 border-b dark:border-brand-dark-border flex items-center gap-2 flex-shrink-0 bg-background sticky top-0 z-10">
          <Input
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange?.(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button variant="ghost" size="icon" onClick={onExitSearch}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div 
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          shouldStickToBottomRef.current = distanceFromBottom < 48;
        }}
        className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2 min-h-0 flex flex-col"
      >
        {hasNextPage && (
          <button className="text-xs text-blue-600 hover:underline mb-2 py-2" onClick={() => fetchNextPage()}>
            Load older messages
          </button>
        )}
        {processedMessages.length === 0 && !isSearching ? (
          <div className="text-xs text-muted-foreground">No messages yet.</div>
        ) : isSearching && processedMessages.length === 0 ? (
          <div className="text-xs text-muted-foreground">No messages found.</div>
        ) : (
          renderedMessages
            .map((item, index, arr) => {
              if (item.type === 'separator') {
                return (
                  <div key={item.id} className="text-center text-xs text-muted-foreground my-2 py-1">
                    {item.count} message{item.count > 1 ? 's' : ''} hidden
                  </div>
                );
              }
              
              // TypeScript now knows item.type === 'message'
              const m = item as Extract<typeof item, { type: 'message' }>;
              if (!m.created_at) return null; // Skip messages without created_at
              
              const prevItem = arr[index - 1];
              const prevIsMessage = prevItem && 'type' in prevItem && prevItem.type === 'message';
              const prevCreatedAt = prevIsMessage && (prevItem as Extract<typeof prevItem, { type: 'message' }>).created_at;
              
              // Show date separator at the first message of each day.
              const showDateSeparator = !isSearching && (index === 0 || (prevIsMessage && prevCreatedAt && isDifferentDay(m.created_at, prevCreatedAt)));
              
              const direction = m.direction as 'INBOUND' | 'OUTBOUND';
              
              return (
                <div key={m.id}>
                  <div className={`flex gap-2 items-end ${direction === 'OUTBOUND' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Staff avatar for outbound messages */}
                    {direction === 'OUTBOUND' && m.staff && (
                      <StaffAvatar
                        staffId={m.staff.id}
                        firstName={m.staff.first_name}
                        lastName={m.staff.last_name}
                      />
                    )}
                    
                    <div className={`max-w-[80%] group relative ${direction === 'OUTBOUND' ? 'text-right' : ''}`}>
                      {!hideAddIssueHover && (
                        <div className={cn(
                          "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10",
                          direction === 'OUTBOUND' ? "right-full mr-2" : "left-full ml-2"
                        )}>
                          {matchedIssues.length === 0 ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full bg-background border shadow-sm hover:bg-muted"
                              onClick={handleCreateIssue}
                              title="Open issue"
                              disabled={isIssueActionLoading}
                            >
                              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground hover:text-warning" />
                            </Button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-full bg-background border shadow-sm hover:bg-muted"
                                  title="Open issue"
                                  disabled={isIssueActionLoading}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground hover:text-warning" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={direction === 'OUTBOUND' ? 'end' : 'start'}>
                                <DropdownMenuItem onClick={handleCreateIssue}>
                                  Create new issue
                                </DropdownMenuItem>
                                {matchedIssues.map((issue) => (
                                  <DropdownMenuItem
                                    key={issue.id}
                                    onClick={() => handleAddToIssue(issue)}
                                  >
                                    <span className="mr-1">Add to open issue:</span>
                                    <TextWithTags text={issue.name} />
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )}

                      {/* Sender badge for outbound messages */}
                      {direction === 'OUTBOUND' && m.sender && (
                        <div className={`mb-1 ${direction === 'OUTBOUND' ? 'flex justify-end' : 'flex justify-start'}`}>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            From: {m.sender.sender_type === 'ALPHANUMERIC' 
                              ? (m.sender.alphanumeric_sender_id || m.sender.label || 'Unknown')
                              : (m.sender.phone_e164 || m.sender.label || 'Unknown')}
                          </Badge>
                        </div>
                      )}
                      {/* Attachments */}
                      {m.message_attachments && m.message_attachments.length > 0 && (
                        <div className={`mb-2 flex flex-col gap-2 ${direction === 'OUTBOUND' ? 'items-end' : 'items-start'}`}>
                          {m.message_attachments.map((attachment) => (
                            <MessageAttachment 
                              key={attachment.id} 
                              attachment={attachment as Tables<'message_attachments'>} 
                              direction={direction}
                            />
                          ))}
                        </div>
                      )}
                      {/* Message body */}
                      {(() => {
                        // Filter out Unicode object replacement character (U+FFFC) and "OBJ" text that appears when attachments are present
                        // The iMessage bridge sends U+FFFC (￼) as a placeholder for attachments
                        const cleanedBody = m.body
                          ?.replace(/\uFFFC/g, '') // Remove Unicode object replacement character
                          .replace(/OBJ/gi, '') // Remove "OBJ" text as fallback
                          .trim() || '';
                        // Only render message body if it has content after cleaning
                        if (!cleanedBody) return null;
                        return (
                          <div className={`inline-block px-3 py-2 rounded-md text-sm whitespace-pre-wrap ${
                            direction === 'OUTBOUND' 
                              ? (m.sender?.provider === 'TWILIO' 
                                  ? 'bg-[#30D158] dark:bg-[#1E8E3E] text-white' 
                                  : 'bg-[#007AFF] dark:bg-[#0A84FF] text-white')
                              : 'bg-muted'
                          }`}>
                            {isSearching && searchTerm ? highlightText(cleanedBody, searchTerm) : cleanedBody}
                          </div>
                        );
                      })()}
                      <div className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5 ${direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                        <span>{formatMessageDate(m.created_at)}</span>
                        {direction === 'OUTBOUND' && m.status && (
                          <span className="text-[9px]">• {formatMessageStatus(m.status)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {showDateSeparator && (
                    <div className="text-center text-xs text-muted-foreground my-3">
                      {formatDaySeparator(m.created_at)}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      <CreateIssueDialog
        isOpen={isCreateIssueOpen}
        onClose={() => setIsCreateIssueOpen(false)}
        initialTags={contactIssueTags}
      />
      <EditIssueDialog
        isOpen={isEditIssueOpen}
        issueId={selectedIssueId}
        onClose={() => {
          setIsEditIssueOpen(false);
          setSelectedIssueId(null);
        }}
      />
    </div>
  );
}
