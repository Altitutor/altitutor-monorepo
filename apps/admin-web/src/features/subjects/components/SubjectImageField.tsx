'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { subjectsApi } from '../api';
import { getSignedUrlFromBucket } from '@/shared/lib/supabase/storage';
import { getErrorMessage } from '@/shared/utils';

export interface SubjectImageFieldProps {
  subjectId: string;
  onImageChanged?: () => void;
}

export function SubjectImageField({ subjectId, onImageChanged }: SubjectImageFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fileRow = await subjectsApi.getSubjectImageFile(subjectId);
      if (fileRow?.storage_path && fileRow.bucket === 'resources') {
        const url = await getSignedUrlFromBucket('resources', fileRow.storage_path, 3600);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    } catch (err) {
      console.error('Failed to load subject image:', err);
      setPreviewUrl(null);
      toast({
        title: 'Could not load image',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [subjectId, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    try {
      await subjectsApi.setSubjectImage(subjectId, file);
      await refresh();
      onImageChanged?.();
      toast({
        title: 'Image updated',
        description: 'Students will see this on subject cards in resources.',
      });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await subjectsApi.removeSubjectImage(subjectId);
      setPreviewUrl(null);
      onImageChanged?.();
      toast({
        title: 'Image removed',
        description: 'This subject will use the default resources appearance.',
      });
    } catch (err) {
      toast({
        title: 'Remove failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Subject image</Label>
      <p className="text-sm text-muted-foreground">
        Shown on student subject cards when browsing resources. Square images work best.
      </p>
      <div className="flex flex-wrap items-start gap-4 mt-2">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, not in next.config images
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || loading}
            onClick={() => inputRef.current?.click()}
            className="w-fit"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {previewUrl ? 'Replace image' : 'Upload image'}
          </Button>
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || loading}
              onClick={handleRemove}
              className="w-fit text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove image
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
