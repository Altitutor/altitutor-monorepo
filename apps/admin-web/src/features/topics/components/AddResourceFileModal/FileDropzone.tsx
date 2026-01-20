import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

export interface FileDropzoneProps {
  onDrop: (files: File[]) => void;
  maxSize: number;
  hasMultipleFiles: boolean;
}

export function FileDropzone({ onDrop, maxSize, hasMultipleFiles }: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-colors
        ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
      `}
    >
      <input {...getInputProps()} />
      <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
      {isDragActive ? (
        <p className="text-sm">Drop the file{hasMultipleFiles ? 's' : ''} here...</p>
      ) : (
        <>
          <p className="text-sm mb-1">
            Drag and drop file{hasMultipleFiles ? 's' : ''} here, or click to select
          </p>
          <p className="text-xs text-muted-foreground">Maximum file size: {(maxSize / 1024 / 1024).toFixed(0)}MB per file</p>
        </>
      )}
    </div>
  );
}
