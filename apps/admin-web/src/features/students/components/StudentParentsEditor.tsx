'use client';

import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  PhoneInput,
} from '@altitutor/ui';
import { Plus, X } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { ParentSearchPopover } from './ParentSearchPopover';
import {
  emptyStudentParentDraft,
  studentParentDraftFromExisting,
  type StudentParentDraft,
} from '../utils/studentParentDrafts';

interface StudentParentsEditorProps {
  value: StudentParentDraft[];
  onChange: (value: StudentParentDraft[]) => void;
  disabled?: boolean;
  showSkip?: boolean;
  skipped?: boolean;
  onSkippedChange?: (skipped: boolean) => void;
}

export function StudentParentsEditor({
  value,
  onChange,
  disabled = false,
  showSkip = false,
  skipped = false,
  onSkippedChange,
}: StudentParentsEditorProps) {
  const selectedParents = value
    .filter((draft) => draft.existing_id)
    .map((draft) => ({ id: draft.existing_id as string }));

  const handleLinkExisting = (parent: Tables<'parents'>) => {
    if (value.some((draft) => draft.existing_id === parent.id)) return;
    onChange([...value, studentParentDraftFromExisting(parent)]);
  };

  const handleAddNew = () => {
    onChange([...value, emptyStudentParentDraft()]);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, patch: Partial<StudentParentDraft>) => {
    onChange(
      value.map((draft, i) => (i === index ? { ...draft, ...patch } : draft))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Label className="text-base font-semibold">
          {showSkip ? 'Parent/Guardian Details' : 'Parents (Optional)'}
        </Label>
        {showSkip && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="skip-parent-details"
              checked={skipped}
              onCheckedChange={(checked) => onSkippedChange?.(checked === true)}
              disabled={disabled}
            />
            <Label htmlFor="skip-parent-details" className="cursor-pointer text-sm font-normal">
              Skip parent details
            </Label>
          </div>
        )}
      </div>

      {!skipped && (
        <div className="space-y-4">
          {value.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Link an existing parent or add a new one.
            </p>
          ) : (
            <div className="space-y-4">
              {value.map((draft, index) => {
                const isExisting = Boolean(draft.existing_id);
                return (
                  <div key={draft.existing_id ?? `new-${index}`} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {isExisting
                            ? `${draft.first_name} ${draft.last_name}`.trim() || 'Linked parent'
                            : `New parent ${index + 1}`}
                        </h4>
                        {isExisting && (
                          <Badge variant="secondary" className="shrink-0">
                            Linked
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(index)}
                        disabled={disabled}
                        aria-label={`Remove ${isExisting ? `${draft.first_name} ${draft.last_name}`.trim() || 'linked parent' : `new parent ${index + 1}`}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {isExisting ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        {draft.email && <span className="truncate">{draft.email}</span>}
                        {draft.phone && <span className="truncate">{draft.phone}</span>}
                        {!draft.email && !draft.phone && (
                          <span>No email or phone on file</span>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`student-parent-${index}-first-name`}>First Name</Label>
                            <Input
                              id={`student-parent-${index}-first-name`}
                              value={draft.first_name}
                              onChange={(e) => handleUpdate(index, { first_name: e.target.value })}
                              disabled={disabled}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`student-parent-${index}-last-name`}>Last Name</Label>
                            <Input
                              id={`student-parent-${index}-last-name`}
                              value={draft.last_name}
                              onChange={(e) => handleUpdate(index, { last_name: e.target.value })}
                              disabled={disabled}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`student-parent-${index}-email`}>Email</Label>
                            <Input
                              id={`student-parent-${index}-email`}
                              type="email"
                              value={draft.email}
                              onChange={(e) => handleUpdate(index, { email: e.target.value })}
                              disabled={disabled}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`student-parent-${index}-phone`}>Phone</Label>
                            <PhoneInput
                              value={draft.phone || ''}
                              onChange={(phone) => handleUpdate(index, { phone: phone || null })}
                              disabled={disabled}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <ParentSearchPopover
              selectedParents={selectedParents}
              onSelectParent={handleLinkExisting}
              align="start"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={disabled}
                >
                  <Plus className="h-4 w-4" />
                  Link existing
                </Button>
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleAddNew}
              disabled={disabled}
            >
              <Plus className="h-4 w-4" />
              Add new
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
