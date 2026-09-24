import type { TablesInsert } from '@altitutor/shared';
import { parentsApi } from '@/features/parents/api/parents';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { studentsApi } from './students';
import type { NewStudentParentDetails } from '../utils/studentParentDrafts';

export async function linkStudentParents(params: {
  studentId: string;
  existingParentIds: string[];
  newParents: NewStudentParentDetails[];
  sessionId?: string;
}): Promise<string[]> {
  const parentIds = [...params.existingParentIds];

  for (const newParent of params.newParents) {
    const parentData: TablesInsert<'parents'> = {
      id: crypto.randomUUID(),
      first_name: newParent.first_name || '',
      last_name: newParent.last_name || '',
      email: newParent.email || null,
      phone: newParent.phone || null,
      created_at: null,
      updated_at: null,
    };
    const created = await parentsApi.create(parentData);
    parentIds.push(created.id);
  }

  for (const parentId of parentIds) {
    await studentsApi.assignStudentToParent(parentId, params.studentId);
    if (params.sessionId) {
      try {
        await sessionsApi.addParentToSession(params.sessionId, parentId);
      } catch (error) {
        const code =
          typeof error === 'object' && error && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';
        if (code !== '23505') throw error;
      }
    }
  }

  return parentIds;
}
