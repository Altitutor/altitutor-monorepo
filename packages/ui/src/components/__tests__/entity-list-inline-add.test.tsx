/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityList } from '../entity-list';
import { SearchableSelect } from '../searchable-select';

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
});

it('cancels an inline draft with Escape, restores add focus and clears the draft', async () => {
  const onAdd = jest.fn();
  render(<EntityList items={[]} getItemId={() => ''} renderName={() => null} rightPills={[]} onAdd={onAdd} inlineAdd hideToolbar addButtonLabel="Add task" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
  fireEvent.change(screen.getByPlaceholderText('Add task'), { target: { value: 'Unfinished task' } });
  fireEvent.keyDown(screen.getByPlaceholderText('Add task'), { key: 'Escape' });
  expect(screen.queryByPlaceholderText('Add task')).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add task' })));
  expect(onAdd).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
  expect((screen.getByPlaceholderText('Add task') as HTMLInputElement).value).toBe('');
});


it('lets an open pill picker handle Escape before cancelling its inline draft', () => {
  render(<EntityList items={[]} getItemId={() => ''} renderName={() => null} rightPills={[{
    key: 'priority', label: 'Priority', visibleByDefault: true, getValue: () => null,
    renderPill: () => <SearchableSelect items={[{id:'1',label:'Urgent'}]} value={null} getItemId={item=>item.id} getItemLabel={item=>item.label} onValueChange={()=>{}} placeholder="Priority" />,
  }]} onAdd={jest.fn()} inlineAdd hideToolbar addButtonLabel="Add task" compact />);
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Escape' });
  expect(screen.getByPlaceholderText('Add task')).toBeTruthy();
  fireEvent.keyDown(screen.getByPlaceholderText('Add task'), { key: 'Escape' });
  expect(screen.queryByPlaceholderText('Add task')).toBeNull();
});
