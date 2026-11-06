'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { AdminPasswordResetSection } from '@/features/auth/components/password-reset/AdminPasswordResetSection';
import { StartInPersonButton } from './StartInPersonButton';
import { SendStudentInviteDialog } from './SendStudentInviteDialog';

export function StudentAccountSection({ student, parents = [] }: {
  student: Tables<'students'>;
  parents?: Tables<'parents'>[];
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const displayName = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Student';

  if (student.deleted_at) return <p className="text-sm text-muted-foreground">Student access is disabled. Restore this record before sending a new invitation.</p>;

  const registrationPending = student.status === 'TRIAL';
  const needsAccountInvite = !student.user_id && student.status === 'ACTIVE';
  return (
    <div className="space-y-4">
      {student.status === null && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">This student has no in-person relationship. Start onboarding to arrange tutoring and registration using the same student record.</p>
          <StartInPersonButton studentId={student.id} />
        </div>
      )}
      {registrationPending && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">In-person registration is pending. Completing registration activates the in-person relationship{student.user_id ? ' using their existing login' : ''}.</p>
          <Button type="button" onClick={() => setInviteOpen(true)}>Send registration link</Button>
        </div>
      )}
      {needsAccountInvite && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">This student has completed in-person registration. Send an invite to set up their login.</p>
          <Button type="button" onClick={() => setInviteOpen(true)}>Send invite</Button>
        </div>
      )}
      {(registrationPending || needsAccountInvite) && (
        <SendStudentInviteDialog isOpen={inviteOpen} onClose={() => setInviteOpen(false)} student={student} linkType={registrationPending ? 'registration' : 'invite'} />
      )}
      {student.user_id && (
        <AdminPasswordResetSection
          userId={student.user_id}
          email={student.email}
          userType="student"
          displayName={displayName}
          recipients={[
            { type: 'student', id: student.id, label: displayName, value: student.phone },
            ...parents.map((parent) => ({ type: 'parent' as const, id: parent.id, label: `${parent.first_name ?? ''} ${parent.last_name ?? ''}`.trim() || 'Parent', value: parent.phone })),
          ]}
        />
      )}
    </div>
  );
}
