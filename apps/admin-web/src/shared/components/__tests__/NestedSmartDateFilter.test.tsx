import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DateRangeFilter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@altitutor/ui';

function NestedSmartDateFilter() {
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [filterOpen, setFilterOpen] = React.useState(true);

  return (
    <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
      <DropdownMenuTrigger>Filter</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Filters</DropdownMenuLabel>
        <DropdownMenuSub open>
          <DropdownMenuSubTrigger>Date</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DateRangeFilter
              fromValue={from}
              toValue={to}
              onFromChange={setFrom}
              onToChange={setTo}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
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

  it('keeps the filter dropdown open after selecting the From date', async () => {
    const user = userEvent.setup();
    render(<NestedSmartDateFilter />);

    await user.click((await screen.findAllByRole('button', { name: 'Select date' }))[0]);
    const todayOptions = await screen.findAllByText('Today');
    await user.click(todayOptions[todayOptions.length - 1]);

    expect(screen.getByText('Filters')).toBeVisible();
    expect(screen.getByText('From date')).toBeVisible();
    expect(screen.getByText('To date')).toBeVisible();
  });
});
