import { ArrowRightLeft, UserMinus } from "lucide-react";
import type { RecordMenuAction } from "@/shared/components/recordMenuActions";
import { ActionEntityChip } from "@/features/entity-references/components/ActionEntityChip";
type Reference = { id: string; label: string };
export function classStudentReferenceActions(
  student: Reference,
  classReference: Reference,
  handlers: { change: () => void; remove: () => void },
): RecordMenuAction[] {
  const chip = <ActionEntityChip type="student" {...student} />;
  const context = { type: "class", ...classReference };
  return [
    {
      id: `change-student-${student.id}`,
      title: `Change ${student.label} to another class`,
      renderTitle: <>Change {chip} to another class</>,
      context,
      icon: ArrowRightLeft,
      action: handlers.change,
    },
    {
      id: `remove-student-${student.id}`,
      title: `Remove ${student.label} from class`,
      renderTitle: <>Remove {chip} from class</>,
      context,
      icon: UserMinus,
      destructive: true,
      action: handlers.remove,
    },
  ];
}
export function classStaffReferenceActions(
  staff: Reference,
  classReference: Reference,
  remove: () => void,
): RecordMenuAction[] {
  return [
    {
      id: `remove-staff-${staff.id}`,
      title: `Remove ${staff.label} from class`,
      renderTitle: (
        <>
          Remove <ActionEntityChip type="staff" {...staff} /> from class
        </>
      ),
      context: { type: "class", ...classReference },
      icon: UserMinus,
      destructive: true,
      action: remove,
    },
  ];
}
