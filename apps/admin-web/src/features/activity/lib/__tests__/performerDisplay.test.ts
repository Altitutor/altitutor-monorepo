import {
  getPerformerAvatarColorClass,
  getPerformerInitials,
  isHumanPerformer,
} from '../performerDisplay';

describe('performerDisplay', () => {
  describe('getPerformerInitials', () => {
    it('returns first and last initials for full names', () => {
      expect(getPerformerInitials('Matthew Chua')).toBe('MC');
    });

    it('returns email initials when given an email address', () => {
      expect(getPerformerInitials('matt@altitutor.com')).toBe('MA');
    });
  });

  describe('isHumanPerformer', () => {
    it('treats system actors as non-human', () => {
      expect(isHumanPerformer('System')).toBe(false);
      expect(isHumanPerformer('Unknown')).toBe(false);
    });

    it('treats named staff as human', () => {
      expect(isHumanPerformer('Matthew Chua')).toBe(true);
    });
  });

  describe('getPerformerAvatarColorClass', () => {
    it('returns theme muted colors', () => {
      expect(getPerformerAvatarColorClass('Matthew Chua')).toBe('bg-muted text-muted-foreground');
    });
  });
});
