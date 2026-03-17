import { Label } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { useTopicsBySubject, useAvailableSolutionLinks } from '../../hooks';
import type { Enums, Tables } from '@altitutor/shared';

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

const RESOURCE_TYPE_ITEMS: { id: string; label: string }[] = RESOURCE_TYPES.map((type) => ({
  id: type,
  label: type.replace(/_/g, ' '),
}));

export interface ResourceFileMetadataProps {
  selectedSubjectId: string | null;
  selectedTopicId: string | null;
  selectedType: Enums<'resource_type'> | null;
  isSolutions: boolean;
  selectedSolutionOfId: string | null;
  preselectedSubjectId?: string;
  preselectedTopicId?: string;
  hasMultipleFiles: boolean;
  onSubjectIdChange: (value: string) => void;
  onTopicIdChange: (value: string) => void;
  onTypeChange: (value: Enums<'resource_type'>) => void;
  onIsSolutionsChange: (checked: boolean) => void;
  onSolutionOfIdChange: (value: string) => void;
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
  onSubjectIdChange,
  onTopicIdChange,
  onTypeChange,
  onIsSolutionsChange,
  onSolutionOfIdChange,
}: ResourceFileMetadataProps) {
  const { data: subjects = [] } = useSubjects();
  const { data: topics = [] } = useTopicsBySubject(selectedSubjectId);
  const { data: availableSolutionLinks = [] } = useAvailableSolutionLinks(
    selectedTopicId,
    selectedType
  );

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) ?? null;
  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;
  const selectedTypeItem =
    RESOURCE_TYPE_ITEMS.find((item) => item.id === selectedType) ?? null;
  const selectedSolutionLink =
    availableSolutionLinks.find((tf) => tf.id === selectedSolutionOfId) ?? null;

  return (
    <div className="space-y-4">
      {/* Subject Selector */}
      <div className="space-y-2">
        <Label htmlFor="subject">Subject *</Label>
        <SearchableSelect
          items={subjects}
          value={selectedSubject}
          onValueChange={(subject) => {
            onSubjectIdChange(subject?.id ?? '');
            onTopicIdChange(''); // Reset topic when subject changes
          }}
          getItemId={(s) => s.id}
          getItemLabel={(s) => s.long_name ?? s.name}
          getItemValue={(s) =>
            `${s.long_name ?? ''} ${s.name ?? ''}`.trim()
          }
          placeholder="Select subject"
          searchPlaceholder="Search subjects..."
          emptyMessage="No subjects found."
          disabled={!!preselectedSubjectId}
        />
      </div>

      {/* Topic Selector */}
      <div className="space-y-2">
        <Label htmlFor="topic">Topic *</Label>
        <SearchableSelect
          items={topics}
          value={selectedTopic}
          onValueChange={(topic) => onTopicIdChange(topic?.id ?? '')}
          getItemId={(t) => t.id}
          getItemLabel={(t) => t.name}
          placeholder="Select topic"
          searchPlaceholder="Search topics..."
          emptyMessage="No topics found."
          disabled={!selectedSubjectId || !!preselectedTopicId}
        />
      </div>

      {/* Type Selector */}
      <div className="space-y-2">
        <Label htmlFor="type">Type *</Label>
        <SearchableSelect<{ id: string; label: string }>
          items={RESOURCE_TYPE_ITEMS}
          value={selectedTypeItem}
          onValueChange={(item) =>
            item && onTypeChange(item.id as Enums<'resource_type'>)
          }
          getItemId={(item) => item.id}
          getItemLabel={(item) => item.label}
          placeholder="Select type"
          searchPlaceholder="Search types..."
          emptyMessage="No types found."
        />
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
              <SearchableSelect<
                Tables<'topics_files'> & { file: Tables<'files'> }
              >
                items={availableSolutionLinks}
                value={selectedSolutionLink}
                onValueChange={(tf) => onSolutionOfIdChange(tf?.id ?? '')}
                getItemId={(tf) => tf.id}
                getItemLabel={(tf) =>
                  `${selectedType} - Index ${tf.index}`
                }
                placeholder="Select file this is solutions for"
                searchPlaceholder="Search files..."
                emptyMessage="No files found."
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
