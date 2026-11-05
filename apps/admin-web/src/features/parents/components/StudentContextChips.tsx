"use client";

import { EntityChip } from "@altitutor/ui";
import { useEntityNavigation } from "@/shared/contexts/EntityNavigation";
import { useParentDetails } from "../hooks/useParentsQuery";

type Student = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
};

/** These chips provide family context; they do not link correspondence to each child. */
export function StudentContextChips({ students }: { students: Student[] }) {
  const navigation = useEntityNavigation();
  return students.map((student) => (
    <EntityChip
      key={student.id}
      entityType="student"
      entityId={student.id}
      label={
        `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() ||
        "Student"
      }
      onClick={() => navigation.openStudent(student.id)}
    />
  ));
}

export function ParentStudentChips({ parentId }: { parentId: string }) {
  const { data } = useParentDetails(parentId);
  return <StudentContextChips students={data?.students ?? []} />;
}
