export type StudentParentDraft = {
  existing_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
};

export type NewStudentParentDetails = {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string | null;
};

export type SplitStudentParentDrafts = {
  existingIds: string[];
  newParents: NewStudentParentDetails[];
};

export type TrialParentPayload = {
  skip_parent_details: boolean;
  parent_first_name?: string;
  parent_last_name?: string;
  parent_email?: string;
  parent_phone?: string;
  existing_parent_ids: string[];
  additional_new_parents: NewStudentParentDetails[];
};

export function emptyStudentParentDraft(): StudentParentDraft {
  return {
    first_name: '',
    last_name: '',
    email: '',
    phone: null,
  };
}

export function studentParentDraftFromExisting(parent: {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}): StudentParentDraft {
  return {
    existing_id: parent.id,
    first_name: parent.first_name ?? '',
    last_name: parent.last_name ?? '',
    email: parent.email ?? '',
    phone: parent.phone,
  };
}

export function studentParentDraftHasDetails(draft: StudentParentDraft): boolean {
  return Boolean(
    draft.existing_id ||
      draft.first_name.trim() ||
      draft.last_name.trim() ||
      draft.email.trim() ||
      (draft.phone && String(draft.phone).trim())
  );
}

export function formatStudentParentDraftLabel(draft: StudentParentDraft): string {
  const name = `${draft.first_name} ${draft.last_name}`.trim();
  return name || draft.email.trim() || (draft.phone ? String(draft.phone).trim() : '') || 'Parent';
}

export function splitStudentParentDrafts(drafts: StudentParentDraft[]): SplitStudentParentDrafts {
  const existingIds: string[] = [];
  const newParents: NewStudentParentDetails[] = [];

  for (const draft of drafts) {
    if (draft.existing_id) {
      existingIds.push(draft.existing_id);
      continue;
    }
    if (!studentParentDraftHasDetails(draft)) continue;
    newParents.push({
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim(),
      email: draft.email.trim() || undefined,
      phone: draft.phone && String(draft.phone).trim() ? draft.phone : null,
    });
  }

  return { existingIds, newParents };
}

export function toTrialParentPayload(
  drafts: StudentParentDraft[],
  skipped: boolean
): TrialParentPayload {
  if (skipped) {
    return {
      skip_parent_details: true,
      existing_parent_ids: [],
      additional_new_parents: [],
    };
  }

  const { existingIds, newParents } = splitStudentParentDrafts(drafts);
  const [firstNew, ...additionalNew] = newParents;

  return {
    skip_parent_details: !firstNew,
    parent_first_name: firstNew?.first_name || undefined,
    parent_last_name: firstNew?.last_name || undefined,
    parent_email: firstNew?.email,
    parent_phone: firstNew?.phone || undefined,
    existing_parent_ids: existingIds,
    additional_new_parents: additionalNew,
  };
}
