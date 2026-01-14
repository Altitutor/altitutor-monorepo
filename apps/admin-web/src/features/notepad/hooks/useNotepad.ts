import { useQuery } from '@tanstack/react-query';
import { notepadApi } from '../api/notepad';

export function useNotepad() {
  return useQuery({
    queryKey: ['admin', 'notepad'],
    queryFn: notepadApi.getNotepad,
  });
}
