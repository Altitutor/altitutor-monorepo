export type ProjectStaffRef = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export function staffDisplayName(staff: ProjectStaffRef | null | undefined): string {
  if (!staff) return 'Unnamed staff';
  return `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Unnamed staff';
}

export function otherMemberIds(memberIds: readonly string[], leadId: string | null): string[] {
  if (!leadId) return [...memberIds];
  return memberIds.filter((id) => id !== leadId);
}

export function memberIdsFromProject(
  members: readonly ProjectStaffRef[] | null | undefined,
  leadId: string | null
): string[] {
  return otherMemberIds((members ?? []).map((member) => member.id), leadId);
}

/** Keep the members-field list in sync when the lead changes: drop the new lead, keep the old lead as a member. */
export function adjustMembersForLeadChange(
  previousLeadId: string | null,
  nextLeadId: string | null,
  memberIds: readonly string[]
): string[] {
  const withoutNextLead = otherMemberIds(memberIds, nextLeadId);
  if (
    previousLeadId &&
    previousLeadId !== nextLeadId &&
    !withoutNextLead.includes(previousLeadId)
  ) {
    return [...withoutNextLead, previousLeadId];
  }
  return withoutNextLead;
}

export function memberIdsEqual(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = [...(a ?? [])].sort();
  const right = [...(b ?? [])].sort();
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
