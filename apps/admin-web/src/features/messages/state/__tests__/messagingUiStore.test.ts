import { getMessagingDraftKey, useMessagingUiStore } from '../messagingUiStore';

describe('getMessagingDraftKey', () => {
  it('keys contact drafts by contact id', () => {
    expect(getMessagingDraftKey({ kind: 'contact', contactId: 'c-1' })).toBe('contact:c-1');
  });

  it('returns null when the contact id is missing', () => {
    expect(getMessagingDraftKey({ kind: 'contact', contactId: null })).toBeNull();
  });

  it('keys group drafts by conversation id', () => {
    expect(getMessagingDraftKey({ kind: 'group', conversationId: 'g-1' })).toBe('group:g-1');
  });
});

describe('messaging list filters', () => {
  afterEach(() => {
    useMessagingUiStore.setState({
      filters: {
        dropdown: { listFilter: 'all', ownedNumberFilter: null },
        page: { listFilter: 'all', ownedNumberFilter: null },
      },
    });
  });

  it('keeps header dropdown filters independent from the messages page', () => {
    const { setListFilter, setOwnedNumberFilter } = useMessagingUiStore.getState();
    setListFilter('dropdown', 'unread');
    setOwnedNumberFilter('dropdown', 'num-1');
    setListFilter('page', 'unreplied');

    const { filters } = useMessagingUiStore.getState();
    expect(filters.dropdown).toEqual({ listFilter: 'unread', ownedNumberFilter: 'num-1' });
    expect(filters.page).toEqual({ listFilter: 'unreplied', ownedNumberFilter: null });
  });
});
