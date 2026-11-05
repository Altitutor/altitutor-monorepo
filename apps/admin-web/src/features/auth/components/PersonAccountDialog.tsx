"use client";

import type { Tables } from "@altitutor/shared";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { AdminPasswordResetSection } from "./password-reset/AdminPasswordResetSection";
import { SendStudentInviteDialog } from "@/features/students/components/SendStudentInviteDialog";
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
  if (!person.user_id) {
    return props.type === "student" ? (
      <SendStudentInviteDialog
        isOpen
        onClose={onClose}
        student={props.person}
        linkType={props.person.status === "ACTIVE" ? "invite" : "registration"}
      />
    ) : (
      <SendInviteDialog isOpen onClose={onClose} staffMember={props.person} />
    );
  }
  const displayName =
    `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
  const recipients =
    props.type === "student"
      ? [
          {
            type: "student" as const,
            id: person.id,
            label: displayName || "Student",
            value: props.person.phone,
          },
          ...props.parents.map((parent) => ({
            type: "parent" as const,
            id: parent.id,
            label:
              `${parent.first_name ?? ""} ${parent.last_name ?? ""}`.trim() ||
              "Parent",
            value: parent.phone,
          })),
        ]
      : [
          {
            type: "staff" as const,
            id: person.id,
            label: displayName || "Staff member",
            value: props.person.phone_number,
          },
        ];
  return (
    <AdminDialogShell
      open
      onClose={onClose}
      title="Password reset"
      subtitle={displayName}
    >
      <AdminPasswordResetSection
        userId={person.user_id}
        email={person.email}
        userType={
          props.type === "student"
            ? "student"
            : props.person.role === "TUTOR"
              ? "tutor"
              : "admin"
        }
        displayName={displayName}
        recipients={recipients}
      />
    </AdminDialogShell>
  );
}
