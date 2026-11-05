"use client";

import type { Tables } from "@altitutor/shared";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { AdminPasswordResetSection } from "./password-reset/AdminPasswordResetSection";
import { SendStudentInviteDialog } from "@/features/students/components/SendStudentInviteDialog";
import { StudentAccountSection } from "@/features/students/components/StudentAccountSection";
import { SendInviteDialog } from "@/features/staff/components/modal/SendInviteDialog";

type Props = { open: boolean; onClose: () => void } & (
  | {
      type: "student";
      person: Tables<"students">;
      parents: Tables<"parents">[];
    }
  | { type: "staff"; person: Tables<"staff"> }
);

/** Reuse the existing account workflows from record actions and the command palette. */
export function PersonAccountDialog(props: Props) {
  if (!props.open) return null;
  const { person, onClose } = props;
  const displayName =
    `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();

  if (props.type === "student") {
    const student = props.person;
    if (student.deleted_at) return null;

    if (!student.user_id && (student.status === "TRIAL" || student.status === "ACTIVE")) {
      return (
        <SendStudentInviteDialog
          isOpen
          onClose={onClose}
          student={student}
          linkType={student.status === "ACTIVE" ? "invite" : "registration"}
        />
      );
    }

    return (
      <AdminDialogShell
        open
        onClose={onClose}
        title={student.status === null || student.status === "TRIAL" ? "Student account" : "Password reset"}
        subtitle={displayName}
      >
        <StudentAccountSection student={student} parents={props.parents} />
      </AdminDialogShell>
    );
  }

  const staff = props.person;
  if (!staff.user_id) {
    return <SendInviteDialog isOpen onClose={onClose} staffMember={staff} />;
  }

  return (
    <AdminDialogShell
      open
      onClose={onClose}
      title="Password reset"
      subtitle={displayName}
    >
      <AdminPasswordResetSection
        userId={staff.user_id}
        email={staff.email}
        userType={staff.role === "TUTOR" ? "tutor" : "admin"}
        displayName={displayName}
        recipients={[
          {
            type: "staff",
            id: staff.id,
            label: displayName || "Staff member",
            value: staff.phone_number,
          },
        ]}
      />
    </AdminDialogShell>
  );
}
