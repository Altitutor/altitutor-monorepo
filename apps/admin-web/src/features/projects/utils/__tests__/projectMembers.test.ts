import {
  adjustMembersForLeadChange,
  memberIdsEqual,
  memberIdsFromProject,
  otherMemberIds,
} from '../projectMembers';

describe('otherMemberIds', () => {
  it('drops the current lead from the members field', () => {
    expect(otherMemberIds(['alice', 'bob'], 'alice')).toEqual(['bob']);
  });

  it('keeps every id when there is no lead', () => {
    expect(otherMemberIds(['alice', 'bob'], null)).toEqual(['alice', 'bob']);
  });
});

describe('memberIdsFromProject', () => {
  it('maps membership rows to the properties-tab list, excluding the lead', () => {
    expect(
      memberIdsFromProject(
        [
          { id: 'alice', first_name: 'Alice', last_name: 'Lead' },
          { id: 'bob', first_name: 'Bob', last_name: 'Member' },
        ],
        'alice'
      )
    ).toEqual(['bob']);
  });
});

describe('adjustMembersForLeadChange', () => {
  it('adds the outgoing lead to members and drops the incoming lead', () => {
    expect(adjustMembersForLeadChange('alice', 'bob', ['bob', 'cara'])).toEqual(['cara', 'alice']);
  });

  it('keeps the outgoing lead as a member when the lead is cleared', () => {
    expect(adjustMembersForLeadChange('alice', null, ['bob'])).toEqual(['bob', 'alice']);
  });

  it('does not duplicate the outgoing lead if they were already listed', () => {
    expect(adjustMembersForLeadChange('alice', 'bob', ['alice'])).toEqual(['alice']);
  });

  it('leaves members unchanged when setting a lead who was not a member', () => {
    expect(adjustMembersForLeadChange(null, 'alice', ['bob'])).toEqual(['bob']);
  });
});

describe('memberIdsEqual', () => {
  it('ignores order', () => {
    expect(memberIdsEqual(['a', 'b'], ['b', 'a'])).toBe(true);
  });
});
