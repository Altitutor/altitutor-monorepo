'use client';

import { Separator } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import type { ClassStaff, ClassStudent } from '../../../api/classes';
import { ClassStudentsTab } from './ClassStudentsTab';
import { ClassStaffTab } from './ClassStaffTab';

interface ClassPeopleTabProps {
  classData: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStudents: ClassStudent[];
  classStaff: ClassStaff[];
  allStudents: Tables<'students'>[];
  allStaff: Tables<'staff'>[];
  onStudentsUpdated?: () => void;
  onAssignStaff: (staffId: string) => void;
  onRemoveStaff: (staffId: string) => void;
  allowStudentEnrollment?: boolean;
}

export function ClassPeopleTab(props: ClassPeopleTabProps) {
  return (
    <div className="space-y-6">
      {props.allowStudentEnrollment !== false ? <>
        <ClassStudentsTab
          classData={props.classData}
          classSubject={props.classSubject}
          classStaff={props.classStaff}
          classStudents={props.classStudents}
          allStudents={props.allStudents}
          loadingStudents={false}
          onStudentsUpdated={props.onStudentsUpdated}
        />
        <Separator />
      </> : (
        <div>
          <h3 className="font-medium">Drop-in students</h3>
          <p className="text-sm text-muted-foreground">
            Homework Help has no enrolment list. Record each student on the Session when they attend.
          </p>
        </div>
      )}
      <ClassStaffTab
        classData={props.classData}
        classSubject={props.classSubject}
        classStaff={props.classStaff}
        allStaff={props.allStaff}
        loadingStaff={false}
        onAssignStaff={props.onAssignStaff}
        onRemoveStaff={props.onRemoveStaff}
      />
    </div>
  );
}
