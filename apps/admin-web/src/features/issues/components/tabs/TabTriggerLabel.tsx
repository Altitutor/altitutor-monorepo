'use client';

import { useStudent } from '@/features/students/hooks/useStudentsQuery';
import { useStaffById } from '@/features/staff/hooks/useStaffQuery';
import { useClassDetails } from '@/features/classes/hooks/useClassesQuery';
import { useSessionData } from '@/features/sessions/hooks';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatClassName } from '@/shared/utils';
import { getSessionTitle } from '@/features/sessions/utils/session-helpers';

interface TabTriggerLabelProps {
  type: 'message' | 'student' | 'staff' | 'class' | 'session' | 'invoice';
  id: string;
}

export function TabTriggerLabel({ type, id }: TabTriggerLabelProps) {
  if (type === 'message') return <MessageLabel id={id} />;
  if (type === 'student') return <StudentLabel id={id} />;
  if (type === 'staff') return <StaffLabel id={id} />;
  if (type === 'class') return <ClassLabel id={id} />;
  if (type === 'session') return <SessionLabel id={id} />;
  if (type === 'invoice') return <InvoiceLabel id={id} />;

  return <span>{type}: {id.slice(0, 8)}</span>;
}

function StudentLabel({ id }: { id: string }) {
  const { data: student } = useStudent(id, true);
  return <span>{student ? `${student.first_name} ${student.last_name}` : `student: ${id.slice(0, 8)}`}</span>;
}

function StaffLabel({ id }: { id: string }) {
  const { data: staffData } = useStaffById(id, true);
  return <span>{staffData?.staff ? `${staffData.staff.first_name} ${staffData.staff.last_name}` : `staff: ${id.slice(0, 8)}`}</span>;
}

function ClassLabel({ id }: { id: string }) {
  const { data: classDetails } = useClassDetails(id, true);
  return <span>{classDetails?.class ? formatClassName(classDetails.class, classDetails.subject) : `class: ${id.slice(0, 8)}`}</span>;
}

function SessionLabel({ id }: { id: string }) {
  const { data: sessionData } = useSessionData({ sessionId: id, enabled: true });
  return <span>{sessionData?.session ? getSessionTitle(sessionData.session) : `session: ${id.slice(0, 8)}`}</span>;
}

function InvoiceLabel({ id }: { id: string }) {
  const { data: invoice } = useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => {
      const { data } = await getSupabaseClient().from('invoices').select('*').eq('id', id).single();
      return data;
    }
  });
  return <span>{invoice ? `Invoice ${invoice.stripe_invoice_number || invoice.id.slice(0, 8)}` : `invoice: ${id.slice(0, 8)}`}</span>;
}

function MessageLabel({ id }: { id: string }) {
  const { data: conversationContact } = useQuery({
    queryKey: ['conversation-contact', id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data: conv } = await supabase
        .from('conversations')
        .select(`
          id,
          participants:conversation_participants(
            staff:staff(first_name, last_name),
            student:students(first_name, last_name)
          )
        `)
        .eq('id', id)
        .single();
      
      if (!conv) return null;
      
      const other = conv.participants.find(p => p.student || p.staff);
      if (other?.student) return `${other.student.first_name} ${other.student.last_name}`;
      if (other?.staff) return `${other.staff.first_name} ${other.staff.last_name}`;
      return id.slice(0, 8);
    }
  });

  return <span>messages: {conversationContact || id.slice(0, 8)}</span>;
}
