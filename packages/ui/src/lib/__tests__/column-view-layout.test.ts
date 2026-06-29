import {
  canResolveDefaultVisibleColumns,
  countColumnViewLayoutDiff,
  countVisibleColumnLayoutDiff,
  ensureAtLeastOneVisibleColumn,
  getDefaultVisibleColumnsFromDefinitions,
  resolveDefaultVisibleColumns,
} from '../column-view-layout';

describe('column-view-layout', () => {
  it('derives defaults from visibleByDefault flags', () => {
    expect(
      getDefaultVisibleColumnsFromDefinitions([
        { key: 'a', label: 'A', visibleByDefault: true },
        { key: 'b', label: 'B', visibleByDefault: false },
        { key: 'c', label: 'C' },
      ]),
    ).toEqual(['a', 'c']);
  });

  it('counts visibility differences', () => {
    expect(countVisibleColumnLayoutDiff(['a', 'b'], ['a', 'c'])).toBe(2);
    expect(countVisibleColumnLayoutDiff(['a', 'b'], ['b', 'a'])).toBe(0);
  });

  it('uses explicit defaults when provided', () => {
    expect(
      resolveDefaultVisibleColumns(
        [{ key: 'a', label: 'A', visibleByDefault: true }],
        ['b'],
      ),
    ).toEqual(['b']);
  });

  it('resolves defaults whenever column definitions exist', () => {
    expect(canResolveDefaultVisibleColumns([{ key: 'a', label: 'A' }])).toBe(true);
    expect(canResolveDefaultVisibleColumns([{ key: 'a', label: 'A' }], ['a'])).toBe(true);
    expect(canResolveDefaultVisibleColumns([])).toBe(false);
  });

  it('keeps at least one visible column', () => {
    expect(ensureAtLeastOneVisibleColumn([], ['a', 'b'])).toEqual(['a']);
    expect(ensureAtLeastOneVisibleColumn(['b'], ['a', 'b'])).toEqual(['b']);
  });

  it('sums diffs across grouped column layouts', () => {
    expect(
      countColumnViewLayoutDiff([
        {
          columnDefinitions: [{ key: 'a', label: 'A', visibleByDefault: true }],
          visibleColumns: ['a', 'b'],
        },
        {
          columnDefinitions: [{ key: 'c', label: 'C', visibleByDefault: true }],
          visibleColumns: [],
          defaultVisibleColumns: ['c'],
        },
      ]),
    ).toBe(2);
  });
});
