'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@altitutor/ui';
import { Upload, Loader2, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@altitutor/ui';
import { FileCard } from '@/features/topics/components/FileCard';
import { sessionFilesApi, type SessionFileWithUrl } from '../api/session-files';
import { getSessionFileSignedUrl } from '@/shared/lib/supabase/storage';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (matching bucket limit)

interface SessionFilesProps {
  sessionId: string;
}

export function SessionFiles({ sessionId }: SessionFilesProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<SessionFileWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const loadFiles = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      setIsLoading(true);
      const sessionFiles = await sessionFilesApi.getSessionFiles(sessionId);
      setFiles(sessionFiles);
    } catch (error) {
      console.error('Failed to load session files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load session files',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, toast]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'Error',
          description: 'File size exceeds 50MB limit',
          variant: 'destructive',
        });
        return;
      }
      setUploadedFile(file);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  });

  const handleUpload = async () => {
    if (!uploadedFile || !sessionId) return;

    try {
      setIsUploading(true);
      await sessionFilesApi.uploadSessionFile({
        sessionId,
        file: uploadedFile,
        displayOrder: files.length,
      });
      
      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });
      
      setUploadedFile(null);
      await loadFiles();
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (sessionFileId: string) => {
    try {
      await sessionFilesApi.deleteSessionFile(sessionFileId);
      toast({
        title: 'Success',
        description: 'File deleted successfully',
      });
      await loadFiles();
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (file: SessionFileWithUrl) => {
    try {
      const signedUrl = await getSessionFileSignedUrl(file.file.storage_path);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = file.file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  // Derive file code from filename (simple approach for session files)
  const getFileCode = (filename: string, index: number) => {
    // Extract extension and create a simple code
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const sanitized = nameWithoutExt.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `SF${String(index + 1).padStart(2, '0')}-${sanitized || 'FILE'}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Files ({files.length})</h3>
      </div>

      {/* Files List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No files uploaded yet
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((sessionFile, index) => (
            <FileCard
              key={sessionFile.id}
              fileCode={getFileCode(sessionFile.file.filename, index)}
              fileType="NOTES" // Default type for session files
              filename={sessionFile.file.filename}
              storagePath={sessionFile.file.storage_path}
              mimeType={sessionFile.file.mimetype || undefined}
              topicFileId={sessionFile.id} // Using sessionFile.id as identifier for delete
              getSignedUrlFn={getSessionFileSignedUrl} // Use session-files bucket
              onDownload={() => handleDownload(sessionFile)}
              onDelete={(id) => handleDelete(id)}
            />
          ))}
        </div>
      )}

      {/* Upload Area */}
      <div className="space-y-2">
        {!uploadedFile ? (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-sm">Drop the file here...</p>
            ) : (
              <>
                <p className="text-sm mb-1">Drag and drop a file here, or click to select</p>
                <p className="text-xs text-muted-foreground">Maximum file size: 50MB</p>
              </>
            )}
          </div>
        ) : (
          <div className="border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUploadedFile(null)}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

