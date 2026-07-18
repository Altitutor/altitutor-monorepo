'use client';

import { useEffect, useRef, useMemo, useState, useLayoutEffect } from 'react';
import { useMessages, useMessagesForContact, useContactHeader } from '../api/queries';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatMessageDate, formatMessageStatus, formatDaySeparator, isDifferentDay } from '../utils/formatDate';
import { StaffAvatar } from './StaffAvatar';
import { X, File, Download, Music, Play, Pause } from 'lucide-react';
import { Input, Button, Badge, type JSONContent } from '@altitutor/ui';
import { messagesKeys } from '../api/queryKeys';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CreateIssueDialog } from '@/features/issues/components/CreateIssueDialog';
import { EditIssueDialog } from '@/features/issues/components/EditIssueDialog';
import { useIssues } from '@/features/issues/api/queries';
import { issuesApi } from '@/features/issues/api/issues';
import type { IssueTagInsert, IssueWithTags, IssueUpdate } from '@/features/issues/types';
import { extractMentions } from '@/shared/utils/extractMentions';
import { cn } from '@/shared/utils';
import { getTagEntity, resolveTagLabels } from '@/features/issues/utils/mentionLabels';
import { ImessageMessageActions } from '../imessage/ImessageMessageActions';
import {
  buildReactionsByTargetGuid,
  collectAttachedReactionIds,
  normalizeImessageGuid,
  reactionTypeToEmoji,
  reactionTypeToLabel,
  type MessageReaction,
} from '../utils/reactions';

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

function issueDescriptionMentionsToDrafts(issue: IssueWithTags): IssueTagDraft[] {
  const description = issue.description as JSONContent | null;
  return extractMentions(description)
    .map((mention): IssueTagDraft | null => {
      if (mention.type === 'student') return { student_id: mention.id };
      if (mention.type === 'staff') return { staff_id: mention.id };
      if (mention.type === 'parent') return { parent_id: mention.id };
      if (mention.type === 'class') return { class_id: mention.id };
      if (mention.type === 'session') return { session_id: mention.id };
      if (mention.type === 'invoice') return { invoice_id: mention.id };
      if (mention.type === 'subject') return { subject_id: mention.id };
      return null;
    })
    .filter((tag): tag is IssueTagDraft => !!tag);
}

interface Props {
  contactId?: string | null;
  conversationId?: string | null;
  ownedNumberId?: string | null;
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

export function MessageThread({
  contactId,
  conversationId,
  ownedNumberId,
  isSearching = false,
  searchTerm = '',
  onSearchTermChange,
  onExitSearch,
  hideAddIssueHover = false
}: Props) {
  const contactMessages = useMessagesForContact(contactId ?? null, ownedNumberId);
  const conversationMessages = useMessages(conversationId ?? '');
  const { data, fetchNextPage, hasNextPage } = conversationId
    ? conversationMessages
    : contactMessages;
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const selectionKey = conversationId ? `group:${conversationId}` : `contact:${contactId ?? ''}`;
  const lastRenderedContactIdRef = useRef<string | null>(null);
  const prevContactId = useRef(selectionKey);
  
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [isEditIssueOpen, setIsEditIssueOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isIssueActionLoading, setIsIssueActionLoading] = useState(false);
  
  // Reset initial load flag when contact changes
  useEffect(() => {
    if (prevContactId.current !== selectionKey) {
      prevContactId.current = selectionKey;
      shouldStickToBottomRef.current = true;
    }
  }, [selectionKey]);

  useEffect(() => {
    if (!contactId && !conversationId) return;
    
    // Get all conversation IDs for this contact to subscribe to all of them
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    
    if (conversationId) {
      channel = supabase
        .channel(`messages-conversation-${conversationId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, () => {
          qc.invalidateQueries({ queryKey: messagesKeys.messages(conversationId) });
        })
        .subscribe();

      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    }

    if (!contactId) return;

    // Fetch conversation IDs for this contact
    supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .in('status', ['OPEN', 'SNOOZED'])
      .then(({ data: conversations }) => {
        if (cancelled) return;
        if (!conversations || conversations.length === 0) return;
        
        const conversationIds = conversations.map((c) => {
          if (!c || typeof c !== 'object' || !('id' in c)) return '';
          return String(c.id);
        }).filter((id): id is string => id !== '');
        
        // Subscribe to messages from all conversations for this contact
        channel = supabase
          .channel(`messages-contact-${contactId}`)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=in.(${conversationIds.join(',')})`
          }, () => {
            // Invalidate to refetch all messages for this contact
            qc.invalidateQueries({ queryKey: messagesKeys.messagesForContact(contactId, ownedNumberId) });
          })
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=in.(${conversationIds.join(',')})`
          }, () => {
            qc.invalidateQueries({ queryKey: messagesKeys.messagesForContact(contactId, ownedNumberId) });
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'conversations',
            filter: `contact_id=eq.${contactId}`
          }, () => {
            qc.invalidateQueries({ queryKey: messagesKeys.messagesForContact(contactId, ownedNumberId) });
          })
          .subscribe();
      });

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [contactId, conversationId, ownedNumberId, qc]);

  // Filter and process messages for search; attach tapbacks onto their target bubbles.
  const processedMessages = useMemo(() => {
    if (!data?.pages) return [];
    const items = data.pages.flatMap(p => p.items);
    const reactionsByTarget = buildReactionsByTargetGuid(items);
    const attachedReactionIds = collectAttachedReactionIds(items, reactionsByTarget);

    type MessageItem = typeof items[number];
    type ProcessedMessageItem =
      | (MessageItem & {
          type: 'message';
          searchTerm?: string;
          reactions: MessageReaction[];
          orphanReactionEmoji?: string | null;
        })
      | { type: 'separator'; count: number; id: string };

    const withReactions = (message: MessageItem, search?: string): Extract<ProcessedMessageItem, { type: 'message' }> => {
      const targetGuid = normalizeImessageGuid(message.imessage_guid);
      const reactions = (!message.is_reaction && targetGuid
        ? reactionsByTarget.get(targetGuid)
        : undefined) ?? [];

      return {
        ...message,
        type: 'message' as const,
        searchTerm: search,
        reactions,
        orphanReactionEmoji: message.is_reaction && !attachedReactionIds.has(message.id)
          ? reactionTypeToEmoji(message.reaction_type)
          : null,
      };
    };

    const visibleItems = items.filter((message) => !attachedReactionIds.has(message.id));

    if (!isSearching || !searchTerm.trim()) {
      return visibleItems.map((message) => withReactions(message)) as ProcessedMessageItem[];
    }

    const search = searchTerm.toLowerCase();
    const filtered: ProcessedMessageItem[] = [];
    let hiddenCount = 0;

    visibleItems.forEach((message, index) => {
      const matches = message.body.toLowerCase().includes(search);

      if (matches) {
        if (hiddenCount > 0) {
          filtered.push({ type: 'separator', count: hiddenCount, id: `sep-${index}` });
          hiddenCount = 0;
        }
        filtered.push(withReactions(message, searchTerm));
      } else {
        hiddenCount++;
      }
    });

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

    const isContactSwitch = lastRenderedContactIdRef.current !== selectionKey;
    if (isContactSwitch || shouldStickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }

    lastRenderedContactIdRef.current = selectionKey;
  }, [selectionKey, renderedMessages.length]);

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
  }, [selectionKey]);

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

  const { data: contact } = useContactHeader(contactId ?? null);
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
      issueDescriptionMentionsToDrafts(issue).some((tag) => {
        const key = getTagKey(tag);
        return !!key && wantedKeys.has(key);
      })
    );
  }, [candidateIssues, contactIssueTags]);

  const appendTagsToIssueDescription = async (issue: IssueWithTags) => {
    const existingIssueTags = issueDescriptionMentionsToDrafts(issue);
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
    const labels = await resolveTagLabels(allTags);
    allTags.forEach((tag) => {
      const entity = getTagEntity(tag);
      if (!entity) return;

      const key = `${entity.type}:${entity.id}`;
      if (existingMentionKeys.has(key)) return;

      existingMentionKeys.add(key);
      mentionParagraphs.push({
        type: 'paragraph',
        content: [
          {
            type: 'mention',
            attrs: {
              id: entity.id,
              type: entity.type,
              label: labels.get(key) || entity.id,
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
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-3 space-y-2 min-h-0 flex flex-col"
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
                  {showDateSeparator && (
                    <div className="text-center text-xs text-muted-foreground my-3">
                      {formatDaySeparator(m.created_at)}
                    </div>
                  )}
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
                      {/* Sender badge for outbound messages */}
                      {direction === 'OUTBOUND' && m.sender && (
                        <div className={`mb-1 ${direction === 'OUTBOUND' ? 'flex justify-end' : 'flex justify-start'}`}>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 max-w-full break-all">
                            From: {m.sender.sender_type === 'ALPHANUMERIC' 
                              ? (m.sender.alphanumeric_sender_id || m.sender.label || 'Unknown')
                              : (m.sender.phone_e164 || m.sender.label || 'Unknown')}
                          </Badge>
                        </div>
                      )}
                      {/* Attachments + body, with iMessage-style reaction badges */}
                      {(() => {
                        if (m.is_reaction) {
                          const emoji = m.orphanReactionEmoji ?? reactionTypeToEmoji(m.reaction_type);
                          if (!emoji) return null;
                          return (
                            <div
                              className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border bg-background px-2 text-base shadow-sm"
                              title={reactionTypeToLabel(m.reaction_type)}
                            >
                              {emoji}
                            </div>
                          );
                        }

                        // Filter out Unicode object replacement character (U+FFFC) and "OBJ" text that appears when attachments are present
                        // The iMessage bridge sends U+FFFC (￼) as a placeholder for attachments
                        const cleanedBody = m.body
                          ?.replace(/\uFFFC/g, '') // Remove Unicode object replacement character
                          .replace(/OBJ/gi, '') // Remove "OBJ" text as fallback
                          .trim() || '';
                        const attachments = m.message_attachments ?? [];
                        const hasAttachments = attachments.length > 0;
                        if (!cleanedBody && !hasAttachments) return null;

                        return (
                          <div className={cn('relative inline-block max-w-full', m.reactions.length > 0 && 'mb-2')}>
                            {hasAttachments && (
                              <div className={cn('flex flex-col gap-2', cleanedBody && 'mb-2', direction === 'OUTBOUND' ? 'items-end' : 'items-start')}>
                                {attachments.map((attachment) => (
                                  <MessageAttachment
                                    key={attachment.id}
                                    attachment={attachment as Tables<'message_attachments'>}
                                    direction={direction}
                                  />
                                ))}
                              </div>
                            )}
                            {cleanedBody ? (
                              <div className={`inline-block px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                                direction === 'OUTBOUND'
                                  ? (m.sender?.provider === 'TWILIO'
                                      ? 'bg-[#30D158] dark:bg-[#1E8E3E] text-white'
                                      : 'bg-[#007AFF] dark:bg-[#0A84FF] text-white')
                                  : 'bg-muted'
                              } break-words [overflow-wrap:anywhere] max-w-full`}>
                                {isSearching && searchTerm ? highlightText(cleanedBody, searchTerm) : cleanedBody}
                              </div>
                            ) : null}
                            {m.reactions.length > 0 && (
                              <div
                                className={cn(
                                  'absolute -bottom-2 z-10 flex items-center gap-0.5',
                                  direction === 'OUTBOUND' ? 'left-1' : 'right-1'
                                )}
                              >
                                {m.reactions.map((reaction) => (
                                  <span
                                    key={reaction.id}
                                    title={reaction.label}
                                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-black/5 bg-background px-1 text-[13px] shadow-sm dark:border-white/10"
                                  >
                                    {reaction.emoji}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5 ${direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                        <span>{formatMessageDate(m.created_at)}</span>
                        {direction === 'OUTBOUND' && m.status && (
                          <span className="text-[9px]">• {formatMessageStatus(m.status)}</span>
                        )}
                        {!m.is_reaction && (
                          <ImessageMessageActions
                            messageId={m.id}
                            conversationId={m.conversation_id}
                            contactId={contactId}
                            imessageGuid={m.imessage_guid}
                            body={(m.body ?? '')
                              .replace(/\uFFFC/g, '')
                              .replace(/OBJ/gi, '')
                              .trim()}
                            sentAt={m.sent_at}
                            createdAt={m.created_at}
                            isOwnMessage={direction === 'OUTBOUND'}
                            showCreateIssue={!hideAddIssueHover}
                            matchedIssues={matchedIssues}
                            issueActionLoading={isIssueActionLoading}
                            onCreateIssue={handleCreateIssue}
                            onAddToIssue={handleAddToIssue}
                          />
                        )}
                      </div>
                    </div>
                  </div>
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
