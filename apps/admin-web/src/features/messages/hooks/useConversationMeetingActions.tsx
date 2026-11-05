"use client";

import { useState } from "react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@altitutor/ui";
import { Calendar, CalendarOff } from "lucide-react";
import { useCurrentStaff } from "@/shared/hooks";
import { useParentDetails } from "@/features/parents/hooks/useParentsQuery";
import { LogAbsenceDialog } from "@/features/sessions/components/absences/LogAbsenceDialog";
import { LogStaffAbsenceDialog } from "@/features/sessions/components/absences/LogStaffAbsenceDialog";
import { BookMeetingMenu } from "../components/BookMeetingMenu";
import {
  getBookMeetingOptions,
  type BookMeetingContact,
} from "../utils/getBookMeetingOptions";

/** Shared operational actions for email and message conversations. */
export function useConversationMeetingActions(
  contact: BookMeetingContact,
  onAction?: () => void,
) {
  const { data: staff } = useCurrentStaff();
  const { data: parent, isLoading } = useParentDetails(
    contact?.parents?.id ?? null,
    !!contact?.parents?.id,
  );
  const [studentId, setStudentId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const students = contact?.students
    ? [contact.students]
    : (parent?.students ?? []);
  const canLog =
    !!staff?.id && !!(contact?.students || contact?.parents || contact?.staff);
  const chooseStudent = (id: string) => {
    setStudentId(id);
    onAction?.();
  };
  const menuItems = (
    <>
      {canLog &&
        (contact?.staff ? (
          <DropdownMenuItem
            onSelect={() => {
              setStaffId(contact.staff!.id);
              onAction?.();
            }}
          >
            <CalendarOff className="mr-2 h-4 w-4" />
            Log absence
          </DropdownMenuItem>
        ) : students.length > 1 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CalendarOff className="mr-2 h-4 w-4" />
              Log absence
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {students.map((student) => (
                <DropdownMenuItem
                  key={student.id}
                  onSelect={() => chooseStudent(student.id)}
                >
                  {`${student.first_name ?? ""} ${student.last_name ?? ""}`.trim()}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <DropdownMenuItem
            disabled={isLoading || !students.length}
            onSelect={() => chooseStudent(students[0].id)}
          >
            <CalendarOff className="mr-2 h-4 w-4" />
            Log absence
          </DropdownMenuItem>
        ))}
      {getBookMeetingOptions(contact).length > 0 && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Calendar className="mr-2 h-4 w-4" />
            Book meeting
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <BookMeetingMenu
              contact={contact}
              variant="menu"
              onAction={onAction}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
    </>
  );
  const dialogs = (
    <>
      {studentId && staff?.id && (
        <LogAbsenceDialog
          isOpen
          initialStudentId={studentId}
          staffId={staff.id}
          onClose={() => setStudentId(null)}
        />
      )}
      {staffId && staff?.id && (
        <LogStaffAbsenceDialog
          isOpen
          initialStaffId={staffId}
          staffId={staff.id}
          onClose={() => setStaffId(null)}
        />
      )}
    </>
  );
  return { menuItems, dialogs, students };
}
