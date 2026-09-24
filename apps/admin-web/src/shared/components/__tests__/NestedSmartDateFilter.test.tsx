import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTableToolbar } from '@altitutor/ui';

function RemountingDateFilterToolbar() {
  const [filters, setFilters] = React.useState<Record<string, unknown[]>>({});

  return (
    <DataTableToolbar
      key={JSON.stringify(filters)}
      state={{
        search: '',
        filters,
        sortBy: null,
        sortDirection: 'asc',
        groupBy: null,
        page: 1,
        pageSize: 20,
        visibleColumns: [],
      }}
      onSearchChange={jest.fn()}
      onFiltersChange={setFilters}
      onSortChange={jest.fn()}
      onGroupByChange={jest.fn()}
      onVisibleColumnsChange={jest.fn()}
      onQuickFilterApply={jest.fn()}
      onReset={jest.fn()}
      filterDefinitions={[
        { key: 'date', label: 'Date', type: 'date-range', fromKey: 'from', toKey: 'to' },
      ]}
      hideSearch
    />
  );
}

describe('nested smart date filter', () => {
  beforeAll(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    HTMLElement.prototype.scrollIntoView = jest.fn();
    HTMLElement.prototype.hasPointerCapture = jest.fn(() => false);
    HTMLElement.prototype.releasePointerCapture = jest.fn();
  });

  it('keeps the Filter and Date menus open when applying a From date remounts the toolbar', async () => {
    const user = userEvent.setup();
    render(<RemountingDateFilterToolbar />);

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await user.keyboard('{End}{ArrowRight}');
    await user.click((await screen.findAllByRole('button', { name: 'Select date' }))[0]);
    const todayOptions = await screen.findAllByText('Today');
    await user.click(todayOptions[todayOptions.length - 1]);

    expect(screen.getByText('Filters')).toBeVisible();
    expect(screen.getByText('From date')).toBeVisible();
    expect(screen.getByText('To date')).toBeVisible();
  });
});
