import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import { formatSubjectDisplay } from '../../utils/bookingHelpers';
import type { Tables } from '@altitutor/shared';

interface SubjectSelectionStepProps {
  sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  selectedSubjectId: string;
  onSelectSubject: (subjectId: string) => void;
  onClearSubject: () => void;
  studentSubjects?: Tables<'subjects'>[];
  allSubjects?: Tables<'subjects'>[];
}

export function SubjectSelectionStep({
  sessionType,
  selectedSubjectId,
  onSelectSubject,
  onClearSubject,
  studentSubjects,
  allSubjects,
}: SubjectSelectionStepProps) {
  const selectedSubject = selectedSubjectId
    ? (studentSubjects?.find((s) => s.id === selectedSubjectId) ||
       allSubjects?.find((s) => s.id === selectedSubjectId))
    : null;

  if (sessionType === 'DRAFTING') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose the subject for the drafting session
        </p>
        {selectedSubjectId && selectedSubject ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 border rounded-md bg-muted/50">
              {formatSubjectDisplay(selectedSubject)}
            </div>
            <Button
              variant="outline"
              onClick={onClearSubject}
            >
              Change
            </Button>
          </div>
        ) : (
          <SubjectSearchPopover
            selectedSubjects={[]}
            onSelectSubject={(subject) => onSelectSubject(subject.id)}
            initialSubjects={studentSubjects || []}
            trigger={
              <Button variant="outline" className="w-full justify-start">
                {studentSubjects && studentSubjects.length > 0
                  ? 'Select subject (shows student subjects, type to search all)'
                  : 'Select subject'}
              </Button>
            }
          />
        )}
        {studentSubjects && studentSubjects.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            Student has no subjects assigned. You can still search and select any subject.
          </p>
        )}
      </div>
    );
  }

  // TRIAL_SESSION or SUBSIDY_INTERVIEW - optional subject selection
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Optionally choose a subject for the {sessionType === 'TRIAL_SESSION' ? 'trial' : 'subsidy interview'} session
      </p>
      {allSubjects && allSubjects.length > 0 && (
        <Select 
          value={selectedSubjectId || 'none'} 
          onValueChange={(value) => onSelectSubject(value === 'none' ? '' : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a subject (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {allSubjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {formatSubjectDisplay(subject)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
