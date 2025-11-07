'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Download, FileIcon, Loader2 } from 'lucide-react';
import { getSignedUrl } from '@/shared/lib/supabase/storage';

export interface FilePreviewProps {
  fileUrl: string; // This is actually storage_path
  fileName: string;
  mimeType: string;
  onDownload?: () => void;
}

export function FilePreview({ fileUrl, fileName, mimeType, onDownload }: FilePreviewProps) {
  const [loading, setLoading] = useState(false);

  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = mimeType.startsWith('image/');

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      // Default download behavior - but this won't work without signed URL
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleView = async () => {
    try {
      setLoading(true);
      // Generate signed URL for viewing
      const signedUrl = await getSignedUrl(fileUrl);
      window.open(signedUrl, '_blank');
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" title={fileName}>
              {fileName}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPdf ? 'PDF Document' : isImage ? 'Image' : 'File'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleView}
            disabled={loading}
            className="flex items-center gap-1"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}

