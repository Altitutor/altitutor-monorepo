'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { useMessagesForContact } from '../api/queries';
import { useMarkRead } from '../api/mutations';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatMessageDate, formatMessageStatus, formatDaySeparator, isDifferentDay } from '../utils/formatDate';
import { StaffAvatar } from './StaffAvatar';
import { Input } from '@altitutor/ui';
import { X, File, Image as ImageIcon, Download, Music, Play, Pause } from 'lucide-react';
import { Button, Badge } from '@altitutor/ui';
import Image from 'next/image';
import { messagesKeys } from '../api/queryKeys';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  contactId: string;
  isSearching?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;
  onExitSearch?: () => void;
}

interface AttachmentProps {
  attachment: any;
  direction: 'INBOUND' | 'OUTBOUND';
}

function MessageAttachment({ attachment, direction }: AttachmentProps) {
  const [imageError, setImageError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Check if it's an image (but exclude HEIC/HEIF which browsers can't display)
  // Note: mime_type may be incomplete (e.g., "image" instead of "image/jpeg"), so we check filename extensions too
  const filenameLower = attachment.filename?.toLowerCase() || '';
  const isHeic = attachment.mime_type === 'image/heic' || 
                attachment.mime_type === 'image/heif' ||
                filenameLower.endsWith('.heic') ||
                filenameLower.endsWith('.heif');
  const isImageByMime = attachment.mime_type?.startsWith('image/') && attachment.mime_type !== 'image' && !isHeic;
  const isImageByExtension = !isHeic && (
    filenameLower.endsWith('.jpg') ||
    filenameLower.endsWith('.jpeg') ||
    filenameLower.endsWith('.png') ||
    filenameLower.endsWith('.gif') ||
    filenameLower.endsWith('.webp') ||
    filenameLower.endsWith('.svg')
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
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-dashed">
        <File className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {attachment.filename || 'Attachment'} (not available)
        </span>
      </div>
    );
  }
  
  // Show loading state while generating signed URL
  if (!signedUrl) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
        <File className="h-4 w-4 text-muted-foreground animate-pulse" />
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
    } catch (error: any) {
      console.error('Failed to download attachment:', error);
      // Fallback: open in new tab
      window.open(attachmentUrl!, '_blank');
    }
  };
  
  // For images: show as main content (like iMessage)
  if (isImage) {
    return (
      <div className="relative group">
        <div className="relative rounded-2xl overflow-hidden border shadow-sm" style={{ maxWidth: '400px', maxHeight: '500px' }}>
          <img
            src={attachmentUrl}
            alt={attachment.filename || 'Image'}
            className="max-h-[500px] max-w-full h-auto w-auto object-contain"
            style={{ display: 'block' }}
            onError={() => setImageError(true)}
          />
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
      <div className="flex flex-col gap-2 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg">
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
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg hover:bg-secondary/70 transition-colors group">
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
        <span className="text-xs truncate">
          {attachment.filename || 'Attachment'}
        </span>
      </a>
      <button
        onClick={handleDownload}
        className="p-1 hover:bg-muted-foreground/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Download file"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function MessageThread({ contactId, isSearching = false, searchTerm = '', onSearchTermChange, onExitSearch }: Props) {
  const { data, fetchNextPage, hasNextPage } = useMessagesForContact(contactId);
  const markRead = useMarkRead();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
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
        
        const conversationIds = conversations.map((c: any) => c.id);
        
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

  // Auto-scroll to bottom on initial load and when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const shouldScroll = isInitialLoad.current || (el.scrollHeight - el.scrollTop - el.clientHeight) < 150;
      if (shouldScroll) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            isInitialLoad.current = false;
          }
        }, 0);
      }
    }
  }, [data]);

  const items = data?.pages?.flatMap(p => p.items) || [];

  // Filter and process messages for search
  const processedMessages = useMemo(() => {
    if (!isSearching || !searchTerm.trim()) {
      return items.slice().reverse();
    }
    
    const search = searchTerm.toLowerCase();
    const reversedItems = items.slice().reverse();
    const filtered: any[] = [];
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
  }, [items, isSearching, searchTerm]);

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
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2 min-h-0">
        {hasNextPage && (
          <button className="text-xs text-blue-600 hover:underline mb-2" onClick={() => fetchNextPage()}>Load older messages</button>
        )}
        {items.length === 0 ? (
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
              
              const m = item;
              const showDateSeparator = !isSearching && (index === 0 || (arr[index - 1]?.type === 'message' && isDifferentDay(m.created_at, arr[index - 1].created_at)));
              
              return (
                <div key={m.id}>
                  {showDateSeparator && (
                    <div className="text-center text-xs text-muted-foreground my-3">
                      {formatDaySeparator(m.created_at)}
                    </div>
                  )}
                  <div className={`flex gap-2 items-end ${m.direction === 'OUTBOUND' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Staff avatar for outbound messages */}
                    {m.direction === 'OUTBOUND' && m.staff && (
                      <StaffAvatar
                        staffId={m.staff.id}
                        firstName={m.staff.first_name}
                        lastName={m.staff.last_name}
                      />
                    )}
                    
                    <div className={`max-w-[80%] ${m.direction === 'OUTBOUND' ? 'text-right' : ''}`}>
                      {/* Sender badge for outbound messages */}
                      {m.direction === 'OUTBOUND' && m.sender && (
                        <div className={`mb-1 ${m.direction === 'OUTBOUND' ? 'flex justify-end' : 'flex justify-start'}`}>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            From: {m.sender.sender_type === 'ALPHANUMERIC' 
                              ? (m.sender.alphanumeric_sender_id || m.sender.label || 'Unknown')
                              : (m.sender.phone_e164 || m.sender.label || 'Unknown')}
                          </Badge>
                        </div>
                      )}
                      {/* Attachments */}
                      {m.message_attachments && m.message_attachments.length > 0 && (
                        <div className={`mb-2 flex flex-col gap-2 ${m.direction === 'OUTBOUND' ? 'items-end' : 'items-start'}`}>
                          {m.message_attachments.map((attachment: any) => (
                            <MessageAttachment 
                              key={attachment.id} 
                              attachment={attachment} 
                              direction={m.direction}
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
                            m.direction === 'OUTBOUND' 
                              ? (m.sender?.provider === 'TWILIO' 
                                  ? 'bg-brand-mediumBlue text-white' 
                                  : 'bg-brand-lightBlue text-brand-dark-bg')
                              : 'bg-muted'
                          }`}>
                            {isSearching && searchTerm ? highlightText(cleanedBody, searchTerm) : cleanedBody}
                          </div>
                        );
                      })()}
                      <div className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5 ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                        <span>{formatMessageDate(m.created_at)}</span>
                        {m.direction === 'OUTBOUND' && m.status && (
                          <span className="text-[9px]">• {formatMessageStatus(m.status)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}


