'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { activityKeys } from '@/features/activity/queryKeys';
import { useRegisterRecordActions } from '@/features/command-palette/RecordActionsContext';
import { useFormResponseOptions, type FormRespondent, type Person } from '../api/formResponseOptions';
import { FillFormDialog } from './FillFormDialog';

export function FormResponseCommands({ record, classMembers }: {
  record: { type: FormRespondent['type'] | 'class' | 'session'; id: string; title: string };
  classMembers?: Person[];
}) {
  const [respondent, setRespondent] = useState<FormRespondent | null>(null);
  const queryClient = useQueryClient();
  const sessionId = record.type === 'session' ? record.id : undefined;
  const { data } = useFormResponseOptions(sessionId, Boolean(sessionId));
  const members = sessionId ? data?.participants : classMembers;
  const submenu = members?.flatMap((member) => {
    if (!member.type) return [];
    const name = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.id;
    const target = { type: member.type, id: member.id, name };
    return [{
      id: `form-${target.type}-${target.id}`,
      title: name,
      icon: ClipboardList,
      keywords: [target.type],
      subtitle: target.type.charAt(0).toUpperCase() + target.type.slice(1),
      action: () => setRespondent(target),
    }];
  });

  const openForRecord = () => {
    if (record.type === 'class' || record.type === 'session') return;
    setRespondent({ type: record.type, id: record.id, name: record.title });
  };
  const isRoster = record.type === 'class' || record.type === 'session';
  useRegisterRecordActions(record.type, record.id, record.title, [{
    id: 'add-form-response',
    title: 'Add form response',
    icon: ClipboardList,
    ...(isRoster ? { submenu: submenu ?? [], disabled: !submenu?.length } : { action: openForRecord }),
  }]);

  if (!respondent) return null;
  return (
    <FillFormDialog
      open
      onClose={() => setRespondent(null)}
      lockedRespondent={respondent}
      sessionId={sessionId}
      onSaved={() => {
        void queryClient.invalidateQueries({ queryKey: activityKeys[respondent.type](respondent.id) });
        if (sessionId) void queryClient.invalidateQueries({ queryKey: activityKeys.session(sessionId) });
      }}
    />
  );
}
