import {
  clearUcatTableUrlParams,
  isUcatTableStateEqual,
  parseShowDeletedFromUrl,
  parseUcatTableStateFromUrl,
  writeShowDeletedToUrl,
  writeUcatTableStateToUrl,
} from '@/features/ucat/shared/lib/ucat-table-url-state'

const defaultColumns = ['name', 'section']

describe('ucat-table-url-state', () => {
  it('round-trips core table state without prefix', () => {
    const params = new URLSearchParams('tab=generated&edit=abc')
    writeUcatTableStateToUrl(
      params,
      {
        search: 'hello',
        filters: { section_id: ['s1', 's2'], visibility: ['private'] },
        sortBy: 'name',
        sortDirection: 'asc',
        groupBy: null,
        page: 2,
        pageSize: 50,
        visibleColumns: ['name', 'section'],
      },
      { defaultPageSize: 20 },
    )
    writeShowDeletedToUrl(params, true)

    expect(params.get('tab')).toBe('generated')
    expect(params.get('edit')).toBe('abc')
    expect(params.get('q')).toBe('hello')
    expect(params.get('sort')).toBe('name')
    expect(params.get('sortDir')).toBe('asc')
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('50')
    expect(params.get('cols')).toBe('name,section')
    expect(params.get('f.section_id')).toBe('s1,s2')
    expect(params.get('f.visibility')).toBe('private')
    expect(params.get('deleted')).toBe('1')

    const parsed = parseUcatTableStateFromUrl(params, {
      initialVisibleColumns: defaultColumns,
    })
    expect(parsed.search).toBe('hello')
    expect(parsed.sortBy).toBe('name')
    expect(parsed.sortDirection).toBe('asc')
    expect(parsed.page).toBe(2)
    expect(parsed.pageSize).toBe(50)
    expect(parsed.filters.section_id).toEqual(['s1', 's2'])
    expect(parseShowDeletedFromUrl(params)).toBe(true)
  })

  it('uses prefixed keys for multi-table pages', () => {
    const params = new URLSearchParams()
    writeUcatTableStateToUrl(
      params,
      {
        search: 'stem',
        filters: { section_id: ['a'] },
        sortBy: null,
        sortDirection: 'desc',
        groupBy: null,
        page: 1,
        pageSize: 20,
        visibleColumns: defaultColumns,
      },
      { paramPrefix: 'noCategory' },
    )

    expect(params.get('noCategory.q')).toBe('stem')
    expect(params.get('noCategory.f.section_id')).toBe('a')
    expect(params.get('q')).toBeNull()

    const parsed = parseUcatTableStateFromUrl(params, {
      initialVisibleColumns: defaultColumns,
      paramPrefix: 'noCategory',
    })
    expect(parsed.search).toBe('stem')
    expect(parsed.filters.section_id).toEqual(['a'])
  })

  it('ignores unknown visible columns', () => {
    const params = new URLSearchParams('cols=name,unknown,section')
    const parsed = parseUcatTableStateFromUrl(params, {
      initialVisibleColumns: defaultColumns,
      availableColumns: defaultColumns,
    })
    expect(parsed.visibleColumns).toEqual(['name', 'section'])
  })

  it('compares table state by value', () => {
    const base = {
      search: 'x',
      filters: { section_id: ['a'] },
      sortBy: 'name',
      sortDirection: 'desc' as const,
      groupBy: null,
      page: 1,
      pageSize: 20,
      visibleColumns: ['name'],
    }
    expect(isUcatTableStateEqual(base, { ...base, filters: { section_id: ['a'] } })).toBe(true)
    expect(isUcatTableStateEqual(base, { ...base, search: 'y' })).toBe(false)
  })

  it('clears only owned params', () => {
    const params = new URLSearchParams(
      'tab=vr&q=old&sort=name&noCategory.q=x&mode=all_time&deleted=1',
    )
    clearUcatTableUrlParams(params)
    expect(params.toString()).toBe('tab=vr&noCategory.q=x&mode=all_time')

    clearUcatTableUrlParams(params, { paramPrefix: 'noCategory' })
    expect(params.toString()).toBe('tab=vr&mode=all_time')
  })
})
