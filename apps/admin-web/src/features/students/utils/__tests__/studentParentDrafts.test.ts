import {
  emptyStudentParentDraft,
  formatStudentParentDraftLabel,
  splitStudentParentDrafts,
  studentParentDraftFromExisting,
  studentParentDraftHasDetails,
  toTrialParentPayload,
  type StudentParentDraft,
} from '../studentParentDrafts';

function newParent(overrides: Partial<StudentParentDraft> = {}): StudentParentDraft {
  return {
    first_name: 'Alex',
    last_name: 'Ng',
    email: 'alex.ng@parent.test',
    phone: '+61411111111',
    ...overrides,
  };
}

describe('studentParentDraftHasDetails', () => {
  it('treats a blank draft as empty', () => {
    expect(studentParentDraftHasDetails(emptyStudentParentDraft())).toBe(false);
  });

  it('treats a linked existing parent as having details', () => {
    expect(
      studentParentDraftHasDetails(
        studentParentDraftFromExisting({
          id: 'parent-1',
          first_name: 'Jordan',
          last_name: 'Lee',
          email: null,
          phone: null,
        })
      )
    ).toBe(true);
  });
});

describe('splitStudentParentDrafts', () => {
  it('keeps linked parents separate from new parent details', () => {
    expect(
      splitStudentParentDrafts([
        studentParentDraftFromExisting({
          id: 'parent-existing',
          first_name: 'Sam',
          last_name: 'Cole',
          email: 'sam.cole@parent.test',
          phone: '+61420000001',
        }),
        newParent(),
        emptyStudentParentDraft(),
      ])
    ).toEqual({
      existingIds: ['parent-existing'],
      newParents: [
        {
          first_name: 'Alex',
          last_name: 'Ng',
          email: 'alex.ng@parent.test',
          phone: '+61411111111',
        },
      ],
    });
  });
});

describe('toTrialParentPayload', () => {
  it('skips parent creation when the staff member chooses skip', () => {
    expect(toTrialParentPayload([newParent()], true)).toEqual({
      skip_parent_details: true,
      existing_parent_ids: [],
      additional_new_parents: [],
    });
  });

  it('sends the first new parent through the trial booking fields and keeps extras for later linking', () => {
    expect(
      toTrialParentPayload(
        [
          studentParentDraftFromExisting({
            id: 'parent-existing',
            first_name: 'Sam',
            last_name: 'Cole',
            email: 'sam.cole@parent.test',
            phone: '+61420000001',
          }),
          newParent({ first_name: 'Alex', last_name: 'Ng' }),
          newParent({
            first_name: 'Riley',
            last_name: 'Tan',
            email: 'riley.tan@parent.test',
            phone: '+61422222222',
          }),
        ],
        false
      )
    ).toEqual({
      skip_parent_details: false,
      parent_first_name: 'Alex',
      parent_last_name: 'Ng',
      parent_email: 'alex.ng@parent.test',
      parent_phone: '+61411111111',
      existing_parent_ids: ['parent-existing'],
      additional_new_parents: [
        {
          first_name: 'Riley',
          last_name: 'Tan',
          email: 'riley.tan@parent.test',
          phone: '+61422222222',
        },
      ],
    });
  });

  it('skips creating a new parent when only existing parents are linked', () => {
    expect(
      toTrialParentPayload(
        [
          studentParentDraftFromExisting({
            id: 'parent-existing',
            first_name: 'Sam',
            last_name: 'Cole',
            email: 'sam.cole@parent.test',
            phone: null,
          }),
        ],
        false
      )
    ).toEqual({
      skip_parent_details: true,
      existing_parent_ids: ['parent-existing'],
      additional_new_parents: [],
    });
  });
});

describe('formatStudentParentDraftLabel', () => {
  it('prefers the parent name', () => {
    expect(formatStudentParentDraftLabel(newParent())).toBe('Alex Ng');
  });
});
