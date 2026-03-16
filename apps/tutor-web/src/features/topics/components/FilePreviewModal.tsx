'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@altitutor/ui';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { FilePreview } from './FilePreview';
import { getSignedUrl } from '@/shared/lib/supabase/storage';
import type { Tables } from '@altitutor/shared';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface FilePreviewModalProps {
  isOpen: boolean;
  fileId: string | null;
  onClose: () => void;
}

export function FilePreviewModal({ isOpen, fileId, onClose }: FilePreviewModalProps) {
  const [file, setFile] = useState<Tables<'files'> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false)
  }, [isOpen])

  useEffect(() => {
    const loadFile = async () => {
      if (!isOpen || !fileId) {
        setFile(null);
        return;
      }

      setIsLoading(true);
      try {
        const supabase = (getSupabaseClient() as SupabaseClient<Database>);
        const { data, error } = await supabase
          .from('files')
          .select('*')
          .eq('id', fileId)
          .single();

        if (error) throw error;
        setFile(data);
      } catch (error) {
        console.error('Error loading file:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [isOpen, fileId]);

  const handleDownload = async () => {
    if (!file) return;
    
    try {
      const signedUrl = await getSignedUrl(file.storage_path);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'max-w-4xl max-h-[90vh] overflow-y-auto',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle>File Preview</DialogTitle>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
        </DialogHeader>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : file ? (
          <FilePreview
            fileUrl={file.storage_path}
            fileName={file.filename}
            mimeType={file.mimetype || 'application/octet-stream'}
            onDownload={handleDownload}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">File not found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

