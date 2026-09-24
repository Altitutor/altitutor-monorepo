'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@altitutor/ui';
import { Upload, Loader2, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@altitutor/ui';
import { FileCard } from '@/shared/components/files/FileCard';
import { studentFilesApi, type StudentFileWithUrl } from '../api/student-files';
import { getStudentFileSignedUrl } from '@/shared/lib/supabase/storage';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface StudentFilesProps {
  studentId: string;
}

export function StudentFiles({ studentId }: StudentFilesProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<StudentFileWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const loadFiles = useCallback(async () => {
    if (!studentId) return;

    try {
      setIsLoading(true);
      const studentFiles = await studentFilesApi.getStudentFiles(studentId);
      setFiles(studentFiles);
    } catch (error) {
      console.error('Failed to load student files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load student files',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [studentId, toast]);

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
    if (!uploadedFile || !studentId) return;

    try {
      setIsUploading(true);
      await studentFilesApi.uploadStudentFile({
        studentId,
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

  const handleDelete = async (studentFileId: string) => {
    try {
      await studentFilesApi.deleteStudentFile(studentFileId);
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

  const handleDownload = async (file: StudentFileWithUrl) => {
    try {
      if (!file.file.storage_path) {
        throw new Error('File is not stored in bucket');
      }
      const signedUrl = await getStudentFileSignedUrl(file.file.storage_path);
      const link = document.createElement('a');
      link.href = signedUrl;

      let downloadName = file.display_name || file.file.filename;
      if (file.display_name && !file.display_name.includes('.')) {
        const extension = file.file.filename.substring(file.file.filename.lastIndexOf('.'));
        downloadName = file.display_name + extension;
      }

      link.download = downloadName;
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

  const handleRename = async (studentFileId: string, newName: string) => {
    try {
      await studentFilesApi.renameStudentFile(studentFileId, newName);
      toast({
        title: 'Success',
        description: 'File renamed successfully',
      });
      await loadFiles();
    } catch (error) {
      console.error('Failed to rename file:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename file',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Files ({files.length})</h3>
      </div>

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
          {files.map((studentFile) => (
            <FileCard
              key={studentFile.id}
              filename={studentFile.file.filename}
              displayName={studentFile.display_name}
              storagePath={studentFile.file.storage_path}
              mimeType={studentFile.file.mimetype || undefined}
              fileId={studentFile.file.id}
              junctionTableId={studentFile.id}
              getSignedUrlFn={getStudentFileSignedUrl}
              onDownload={() => handleDownload(studentFile)}
              onDelete={(id) => handleDelete(id)}
              onRename={(id, newName) => handleRename(id, newName)}
            />
          ))}
        </div>
      )}

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
