import { Label } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { useTopicsBySubject, useAvailableSolutionLinks } from '../../hooks';
import type { Enums } from '@altitutor/shared';

const RESOURCE_TYPES: Enums<'resource_type'>[] = [
  'NOTES',
  'PRACTICE_QUESTIONS',
  'TEST',
  'VIDEO',
  'EXAM',
  'FLASHCARDS',
  'REVISION_SHEET',
  'CHEAT_SHEET',
];

export interface ResourceFileMetadataProps {
  selectedSubjectId: string | null;
  selectedTopicId: string | null;
  selectedType: Enums<'resource_type'> | null;
  isSolutions: boolean;
  selectedSolutionOfId: string | null;
  preselectedSubjectId?: string;
  preselectedTopicId?: string;
  hasMultipleFiles: boolean;
  subjectSearchQuery: string;
  onSubjectIdChange: (value: string) => void;
  onTopicIdChange: (value: string) => void;
  onTypeChange: (value: Enums<'resource_type'>) => void;
  onIsSolutionsChange: (checked: boolean) => void;
  onSolutionOfIdChange: (value: string) => void;
  onSubjectSearchQueryChange: (value: string) => void;
}

export function ResourceFileMetadata({
  selectedSubjectId,
  selectedTopicId,
  selectedType,
  isSolutions,
  selectedSolutionOfId,
  preselectedSubjectId,
  preselectedTopicId,
  hasMultipleFiles,
  subjectSearchQuery,
  onSubjectIdChange,
  onTopicIdChange,
  onTypeChange,
  onIsSolutionsChange,
  onSolutionOfIdChange,
  onSubjectSearchQueryChange,
}: ResourceFileMetadataProps) {
  const { data: subjects = [] } = useSubjects();
  const { data: topics = [] } = useTopicsBySubject(selectedSubjectId);
  const { data: availableSolutionLinks = [] } = useAvailableSolutionLinks(
    selectedTopicId,
    selectedType
  );

  // Filter subjects based on search query
  const filteredSubjects = subjects.filter((subject) => {
    if (!subjectSearchQuery) return true;
    const query = subjectSearchQuery.toLowerCase();
    const displayText = (subject?.long_name ?? '').toLowerCase();
    return displayText.includes(query) || subject.name.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-4">
      {/* Subject Selector */}
      <div className="space-y-2">
        <Label htmlFor="subject">Subject *</Label>
        <Select
          value={selectedSubjectId || ''}
          onValueChange={(value) => {
            onSubjectIdChange(value);
            onTopicIdChange(''); // Reset topic when subject changes
          }}
          disabled={!!preselectedSubjectId}
        >
          <SelectTrigger id="subject">
            <SelectValue placeholder="Select subject" />
          </SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <input
                type="text"
                placeholder="Search subjects..."
                value={subjectSearchQuery}
                onChange={(e) => onSubjectSearchQueryChange(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {filteredSubjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {(subject?.long_name ?? '')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Topic Selector */}
      <div className="space-y-2">
        <Label htmlFor="topic">Topic *</Label>
        <Select
          value={selectedTopicId || ''}
          onValueChange={onTopicIdChange}
          disabled={!selectedSubjectId || !!preselectedTopicId}
        >
          <SelectTrigger id="topic">
            <SelectValue placeholder="Select topic" />
          </SelectTrigger>
          <SelectContent>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Type Selector */}
      <div className="space-y-2">
        <Label htmlFor="type">Type *</Label>
        <Select
          value={selectedType || ''}
          onValueChange={(value) => onTypeChange(value as Enums<'resource_type'>)}
        >
          <SelectTrigger id="type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_TYPES.map((type: Enums<'resource_type'>) => (
              <SelectItem key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Solutions Checkbox - Only show when single file */}
      {!hasMultipleFiles && (
        <>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_solutions"
              checked={isSolutions}
              onCheckedChange={(checked) => {
                onIsSolutionsChange(checked as boolean);
                if (!checked) {
                  onSolutionOfIdChange('');
                }
              }}
            />
            <Label htmlFor="is_solutions" className="cursor-pointer">
              This is a solutions file
            </Label>
          </div>

          {/* Solutions Link Selector */}
          {isSolutions && selectedTopicId && selectedType && (
            <div className="space-y-2">
              <Label htmlFor="solutions_of">Solutions For *</Label>
              <Select
                value={selectedSolutionOfId || ''}
                onValueChange={onSolutionOfIdChange}
              >
                <SelectTrigger id="solutions_of">
                  <SelectValue placeholder="Select file this is solutions for" />
                </SelectTrigger>
                <SelectContent>
                  {availableSolutionLinks.map((tf) => (
                    <SelectItem key={tf.id} value={tf.id}>
                      {selectedType} - Index {tf.index}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}
    </div>
  );
}
