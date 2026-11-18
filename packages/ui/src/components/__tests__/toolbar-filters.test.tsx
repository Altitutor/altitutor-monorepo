/** @jest-environment jsdom */
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {ToolbarAddFilter} from '../toolbar-filters';
import {KeyboardNavigationProvider} from '../keyboard-navigation';
beforeAll(()=>{
  global.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}};
  Element.prototype.scrollIntoView=jest.fn();
});
it('finds and applies a filter value from the Add filter search', async()=>{
  const change=jest.fn();
  render(<KeyboardNavigationProvider value><ToolbarAddFilter persistenceKey="search-filter-values" filters={{}} onChange={change} definitions={[{key:'status',label:'Status',options:[{value:'active',label:'Active'},{value:'archived',label:'Archived'}]}]}/></KeyboardNavigationProvider>);
  fireEvent.keyDown(screen.getByRole('button',{name:'Add filter'}),{key:'ArrowDown'});
  fireEvent.change(screen.getByRole('combobox',{name:'Search filters'}),{target:{value:'status active'}});
  const option=await screen.findByRole('option',{name:'Status → Active'});
  fireEvent.click(option);
  await waitFor(()=>expect(change).toHaveBeenCalledWith({status:['active']}));
});
it('searches within the selected filter submenu without switching to the outer menu search', async()=>{
  render(<KeyboardNavigationProvider value><ToolbarAddFilter persistenceKey="search-inside-filter" filters={{}} onChange={jest.fn()} definitions={[{key:'status',label:'Status',options:[{value:'active',label:'Active'},{value:'archived',label:'Archived'}]}]}/></KeyboardNavigationProvider>);
  fireEvent.keyDown(screen.getByRole('button',{name:'Add filter'}),{key:'ArrowDown'});
  fireEvent.keyDown(screen.getByRole('menuitem',{name:'Status'}),{key:'ArrowRight'});
  const search=await screen.findByPlaceholderText('Search status...');
  fireEvent.change(search,{target:{value:'Archived'}});
  expect(screen.queryByRole('option',{name:'Active'})).toBeNull();
  expect(screen.getByRole('option',{name:'Archived'})).toBeTruthy();
});
it('chooses the last matching filter value with ArrowUp and Enter from search', async()=>{
  const change=jest.fn();
  render(<KeyboardNavigationProvider value><ToolbarAddFilter persistenceKey="keyboard-filter-values" filters={{}} onChange={change} definitions={[{key:'status',label:'Status',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]}]}/></KeyboardNavigationProvider>);
  fireEvent.keyDown(screen.getByRole('button',{name:'Add filter'}),{key:'ArrowDown'});
  const input=screen.getByRole('combobox',{name:'Search filters'});
  fireEvent.change(input,{target:{value:'act'}});
  fireEvent.keyDown(input,{key:'ArrowUp'});
  fireEvent.keyDown(input,{key:'Enter'});
  await waitFor(()=>expect(change).toHaveBeenCalledWith({status:['inactive']}));
});
