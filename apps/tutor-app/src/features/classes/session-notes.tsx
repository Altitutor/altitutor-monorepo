import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, Label, LoadingBlock, SectionTitle, Value } from '@/components/tutor-ui';

import { deleteSessionNote, getSessionNotes, saveSessionNote } from './api';
import { ControlRow, OperationButton, OperationInput } from './operation-controls';
import { notesKey } from './queries';
import { plainNote, records, sessionDate } from './session-model';

function isPlainNote(content: unknown): boolean {
  if (typeof content === 'string') return true;
  const root = records([content])[0];
  if (root?.type !== 'doc' || !Array.isArray(root.content)) return false;
  return root.content.every((value) => {
    const paragraph = records([value])[0];
    return paragraph?.type === 'paragraph' && !paragraph.attrs &&
      (paragraph.content === undefined || (Array.isArray(paragraph.content) && paragraph.content.every((value) => {
        const text = records([value])[0];
        return text?.type === 'text' && typeof text.text === 'string' && !text.marks;
      })));
  });
}

export function SessionNotes({ sessionId, tutorId, editable }: { sessionId: string; tutorId: string | null; editable: boolean }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: notesKey(sessionId), queryFn: () => getSessionNotes(sessionId) });
  const [editing, setEditing] = useState<{ id?: string; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (input: { id?: string; text: string } | { delete: string }) => 'delete' in input
      ? deleteSessionNote(input.delete)
      : saveSessionNote(sessionId, input.text.trim(), input.id),
    onSuccess: async (_result, input) => {
      if ('delete' in input) setConfirmDeleteId(null);
      else setEditing(null);
      await client.invalidateQueries({ queryKey: notesKey(sessionId) });
    },
  });

  return (
    <>
      <SectionTitle>Session notes</SectionTitle>
      {query.isPending ? <LoadingBlock label="Loading notes…" /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {query.data?.length === 0 ? <EmptyBlock>No session notes yet.</EmptyBlock> : null}
      {query.data?.map((note) => {
        if (!note.id) return null;
        const noteId = note.id;
        const staff = records([note.staff])[0];
        const name = [staff?.first_name, staff?.last_name].filter((part) => typeof part === 'string' && part).join(' ');
        const attribution = [name, note.created_at ? sessionDate(note.created_at) : null].filter(Boolean).join(' · ');
        const text = plainNote(note.note);
        const owned = editable && tutorId && note.created_by === tutorId;
        return (
          <Card key={noteId}>
            {attribution ? <Label>{attribution}</Label> : null}
            <Value>{text || 'Note content unavailable'}</Value>
            {owned && editing?.id !== noteId && confirmDeleteId !== noteId ? (
              <ControlRow>
                {isPlainNote(note.note) ? <OperationButton label="Edit note" disabled={mutation.isPending} onPress={() => {
                  mutation.reset();
                  setConfirmDeleteId(null);
                  setEditing({ id: noteId, text });
                }} /> : null}
                <OperationButton label="Delete note" disabled={mutation.isPending} onPress={() => {
                  mutation.reset();
                  setConfirmDeleteId(noteId);
                }} />
              </ControlRow>
            ) : null}
            {owned && confirmDeleteId === noteId ? (
              <View style={{ gap: 8 }}>
                <Label>Delete this session note?</Label>
                <ControlRow>
                  <OperationButton label="Cancel" disabled={mutation.isPending} onPress={() => setConfirmDeleteId(null)} />
                  <OperationButton label={mutation.isPending ? 'Deleting…' : 'Confirm delete'}
                    disabled={mutation.isPending} onPress={() => mutation.mutate({ delete: noteId })} />
                </ControlRow>
              </View>
            ) : null}
          </Card>
        );
      })}
      {editable && editing ? (
        <Card>
          <OperationInput
            accessibilityLabel={editing.id ? 'Edit session note' : 'New session note'}
            value={editing.text}
            placeholder="Write a session note"
            multiline
            editable={!mutation.isPending}
            onChangeText={(text) => setEditing({ ...editing, text })}
          />
          <ControlRow>
            <OperationButton label="Cancel" disabled={mutation.isPending} onPress={() => setEditing(null)} />
            <OperationButton label={mutation.isPending ? 'Saving…' : 'Save note'} prominent
              disabled={!editing.text.trim() || mutation.isPending} onPress={() => mutation.mutate(editing)} />
          </ControlRow>
        </Card>
      ) : null}
      {editable && !editing ? (
        <ControlRow><OperationButton label="Add note" disabled={mutation.isPending}
          onPress={() => { mutation.reset(); setEditing({ text: '' }); }} /></ControlRow>
      ) : null}
      {mutation.isError ? <ErrorBlock message={mutation.error.message} /> : null}
    </>
  );
}
