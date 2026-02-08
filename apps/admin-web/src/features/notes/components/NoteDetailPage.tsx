'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { ArrowLeft, Edit, Eye, Save, X } from 'lucide-react';
import { NoteEditor } from './NoteEditor';
import { NoteViewer } from './NoteViewer';
import { useNote } from '../api/queries';
import { useUpdateNote, useDeleteNote } from '../api/mutations';
import { useFolders } from '../api/queries';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { useDebounce } from '@/shared/hooks';

interface NoteDetailPageProps {
  noteId: string;
}

export function NoteDetailPage({ noteId }: NoteDetailPageProps) {
  const router = useRouter();
  const { data: note, isLoading } = useNote(noteId);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const { data: folders } = useFolders();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [lastSavedContent, setLastSavedContent] = useState<string>('');

  // Initialize form data when note loads
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content || '');
      setFolderId(note.folder_id);
      setLastSavedContent(note.content || '');
    }
  }, [note]);

  // Debounced auto-save for content
  const debouncedContent = useDebounce(content, 1000);
  useEffect(() => {
    if (isEditing && note && debouncedContent !== lastSavedContent && debouncedContent !== (note.content || '')) {
      updateNote.mutate({
        id: noteId,
        updates: { content: debouncedContent },
      });
      setLastSavedContent(debouncedContent);
    }
  }, [debouncedContent, isEditing, note, noteId, updateNote, lastSavedContent]);

  const handleSave = async () => {
    if (!note) return;

    try {
      await updateNote.mutateAsync({
        id: noteId,
        updates: {
          title,
          content,
          folder_id: folderId,
        },
      });
      setLastSavedContent(content);
      setIsEditing(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCancel = () => {
    if (note) {
      setTitle(note.title);
      setContent(note.content || '');
      setFolderId(note.folder_id);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!note) return;
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await deleteNote.mutateAsync(noteId);
      router.push('/notes');
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!note) {
    return <div className="p-6">Note not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b p-4 space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/notes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            {isEditing ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl font-bold"
                placeholder="Note title"
              />
            ) : (
              <h1 className="text-2xl font-bold">{title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Folder selector */}
        {isEditing && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Folder:</span>
            <Select value={folderId || undefined} onValueChange={(value) => setFolderId(value || null)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="No folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {folders?.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isEditing ? (
          <NoteEditor
            content={content}
            onChange={setContent}
            autoFocus={true}
            className="min-h-full"
          />
        ) : (
          <NoteViewer content={content} className="min-h-full" />
        )}
      </div>
    </div>
  );
}
