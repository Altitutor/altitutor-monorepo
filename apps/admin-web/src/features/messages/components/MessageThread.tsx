'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import Image from 'next/image';
import { useMessagesForContact } from '../api/queries';
import { useMarkRead } from '../api/mutations';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatMessageDate, formatMessageStatus, formatDaySeparator, isDifferentDay } from '../utils/formatDate';
import { StaffAvatar } from './StaffAvatar';
import { Input } from '@altitutor/ui';
import { X, File, Download, Music, Play, Pause, Loader2 } from 'lucide-react';
import { Button, Badge } from '@altitutor/ui';
import { messagesKeys } from '../api/queryKeys';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isHeicFile, convertHeicUrlToPreview } from '../utils/heicConverter';

interface Props {
  contactId: string;
  isSearching?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;
  onExitSearch?: () => void;
}

interface AttachmentProps {
  attachment: Tables<'message_attachments'>;
  direction: 'INBOUND' | 'OUTBOUND';
}

export function MessageAttachment({ attachment }: AttachmentProps) {
  const [imageError, setImageError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState(false);
  const [heicPreviewUrl, setHeicPreviewUrl] = useState<string | null>(null);
  const [heicConverting, setHeicConverting] = useState(false);
  const [heicError, setHeicError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Check if it's HEIC/HEIF
  const filenameLower = attachment.filename?.toLowerCase() || '';
  const isHeic = isHeicFile({ mimeType: attachment.mime_type ?? undefined, filename: attachment.filename ?? undefined });
  
  // Check if it's an image (including HEIC)
  const isImageByMime = attachment.mime_type?.startsWith('image/') && attachment.mime_type !== 'image';
  const isImageByExtension = (
    filenameLower.endsWith('.jpg') ||
    filenameLower.endsWith('.jpeg') ||
    filenameLower.endsWith('.png') ||
    filenameLower.endsWith('.gif') ||
    filenameLower.endsWith('.webp') ||
    filenameLower.endsWith('.svg') ||
    filenameLower.endsWith('.heic') ||
    filenameLower.endsWith('.heif')
  );
  const isImage = (isImageByMime || isImageByExtension) && !imageError;
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

  // Convert HEIC to JPEG for preview if needed (must be before early returns)
  useEffect(() => {
    if (isHeic && signedUrl && !heicPreviewUrl && !heicConverting && !heicError) {
      setHeicConverting(true);
      convertHeicUrlToPreview(signedUrl)
        .then((url) => {
          setHeicPreviewUrl(url);
          setHeicConverting(false);
        })
        .catch((error) => {
          console.error('Failed to convert HEIC:', error);
          setHeicError(true);
          setHeicConverting(false);
        });
    }

    // Cleanup blob URL on unmount
    return () => {
      if (heicPreviewUrl) {
        URL.revokeObjectURL(heicPreviewUrl);
      }
    };
  }, [isHeic, signedUrl, heicPreviewUrl, heicConverting, heicError]);
  
  // Show error state if URL generation failed
  if (urlError) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-dashed max-w-[400px]">
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
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg max-w-[400px]">
        <File className="h-4 w-4 text-muted-foreground animate-pulse shrink-0" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Use converted HEIC preview if available, otherwise use signed URL
  const attachmentUrl = (isHeic && heicPreviewUrl) ? heicPreviewUrl : signedUrl;

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
  
  // For images: show as main content (like iMessage)
  if (isImage) {
    // Show loading state while converting HEIC
    if (isHeic && heicConverting) {
      return (
        <div className="relative group">
          <div className="relative rounded-2xl overflow-hidden border shadow-sm flex items-center justify-center" style={{ maxWidth: '400px', maxHeight: '500px', minHeight: '200px' }}>
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Converting HEIC...</span>
            </div>
          </div>
        </div>
      );
    }

    // Show error state if HEIC conversion failed
    if (isHeic && heicError) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-dashed max-w-[400px]">
          <File className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1 min-w-0" title={attachment.filename || 'HEIC Image'}>
            {attachment.filename || 'HEIC Image'} (preview unavailable)
          </span>
          <button
            onClick={handleDownload}
            className="ml-auto p-1 hover:bg-muted-foreground/20 rounded shrink-0"
            aria-label="Download file"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="relative group">
        <div className="relative rounded-2xl overflow-hidden border shadow-sm" style={{ maxWidth: '400px', maxHeight: '500px' }}>
          <div className="relative w-full h-[500px]">
            <Image
              src={attachmentUrl || ''}
              alt={attachment.filename || 'Image'}
              fill
              className="object-contain"
              unoptimized
              onError={() => setImageError(true)}
            />
          </div>
          {/* Download button overlay */}
          <button
            onClick={handleDownload}
            className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Download image"
          >
            <Download className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    );
  }
  
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
    <div className="flex flex-col gap-1 px-3 py-2 bg-muted border border-border/50 rounded-lg hover:bg-muted/80 transition-colors group max-w-[400px]">
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

export function MessageThread({ contactId, isSearching = false, searchTerm = '', onSearchTermChange, onExitSearch }: Props) {
  const { data, fetchNextPage, hasNextPage } = useMessagesForContact(contactId);
  const markRead = useMarkRead();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevContactId = useRef(contactId);
  const lastMarkedMessageId = useRef<string | null>(null);
  const markReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Reset initial load flag when contact changes
  useEffect(() => {
    if (prevContactId.current !== contactId) {
      isInitialLoad.current = true;
      prevContactId.current = contactId;
      lastMarkedMessageId.current = null; // Reset when contact changes
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

  // Use IntersectionObserver on sentinel element - simple and reliable (like WhatsApp/Messages)
  // This automatically handles: initial load, new messages, images loading, etc.
  useEffect(() => {
    if (!sentinelRef.current || !scrollRef.current) return;
    
    const sentinel = sentinelRef.current;
    const scrollContainer = scrollRef.current;
    
    // Track if user has manually scrolled away from bottom
    let userScrolledAway = false;
    
    const handleScroll = () => {
      if (!scrollRef.current) return;
      const currentScrollTop = scrollRef.current.scrollTop;
      const distanceFromBottom = scrollRef.current.scrollHeight - currentScrollTop - scrollRef.current.clientHeight;
      
      // User scrolled away if they're more than 100px from bottom
      userScrolledAway = distanceFromBottom > 100;
    };
    
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    
    // When sentinel becomes invisible (images push it down), scroll it back into view
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // If sentinel is not visible and user hasn't scrolled away, scroll it back into view
        if (!entry.isIntersecting && (!userScrolledAway || isInitialLoad.current)) {
          sentinel.scrollIntoView({ behavior: 'instant', block: 'end' });
        }
      },
      {
        root: scrollContainer,
        rootMargin: '0px',
        threshold: 0,
      }
    );
    
    observer.observe(sentinel);
    
    // Initial scroll to bottom
    if (isInitialLoad.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (sentinelRef.current) {
            sentinelRef.current.scrollIntoView({ behavior: 'instant', block: 'end' });
            isInitialLoad.current = false;
          }
        });
      });
    }
    
    return () => {
      observer.disconnect();
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [data]);

  // Filter and process messages for search
  const processedMessages = useMemo(() => {
    if (!data?.pages) return [];
    const items = data.pages.flatMap(p => p.items);
    
    type MessageItem = typeof items[number];
    type ProcessedMessageItem = 
      | (MessageItem & { type: 'message'; searchTerm?: string })
      | { type: 'separator'; count: number; id: string };
    
    if (!isSearching || !searchTerm.trim()) {
      // When not searching, return items with type 'message'
      return items.slice().reverse().map((m) => ({ ...m, type: 'message' as const })) as ProcessedMessageItem[];
    }
    
    const search = searchTerm.toLowerCase();
    const reversedItems = items.slice().reverse();
    const filtered: ProcessedMessageItem[] = [];
    let hiddenCount = 0;
    
    reversedItems.forEach((m, index) => {
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

  // Prevent scroll events from propagating to the page behind
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isScrollable = scrollHeight > clientHeight;
      
      if (!isScrollable) {
        // If not scrollable, allow event to propagate to page
        return;
      }
      
      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
      
      // Always stop propagation to prevent page scrolling
      e.stopPropagation();
      
      // Only prevent default when at boundaries to prevent overscroll
      if ((e.deltaY > 0 && isAtBottom) || (e.deltaY < 0 && isAtTop)) {
        e.preventDefault();
      }
    };

    scrollElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      scrollElement.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
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
        className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2 min-h-0"
      >
        {hasNextPage && (
          <button className="text-xs text-blue-600 hover:underline mb-2" onClick={() => fetchNextPage()}>Load older messages</button>
        )}
        {processedMessages.length === 0 && !isSearching ? (
          <div className="text-xs text-muted-foreground">No messages yet.</div>
        ) : isSearching && processedMessages.length === 0 ? (
          <div className="text-xs text-muted-foreground">No messages found.</div>
        ) : (
          processedMessages
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
              const showDateSeparator = !isSearching && (index === 0 || (prevIsMessage && prevCreatedAt && isDifferentDay(m.created_at, prevCreatedAt)));
              const isLastMessage = index === arr.length - 1;
              
              const direction = m.direction as 'INBOUND' | 'OUTBOUND';
              
              return (
                <div key={m.id} ref={isLastMessage ? lastMessageRef : undefined}>
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
                    
                    <div className={`max-w-[80%] ${direction === 'OUTBOUND' ? 'text-right' : ''}`}>
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
                </div>
              );
            })
        )}
        {/* Sentinel element at bottom - IntersectionObserver watches this */}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </div>
  );
}


