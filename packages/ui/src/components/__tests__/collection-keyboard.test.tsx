/** @jest-environment jsdom */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SmartDatePickerPill } from "../smart-date-picker";
import { SearchableSelect } from "../searchable-select";
import { CollectionField } from "../collection-picker-context";
import { KeyboardCollection, CollectionRecord } from "../collection-keyboard";
import { KanbanBoard } from "../kanban-board";
import { KeyboardNavigationProvider } from "../keyboard-navigation";
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = jest.fn().mockReturnValue({matches:false,addEventListener:jest.fn(),removeEventListener:jest.fn()});
});
it("selects two records with the keyboard and applies a chosen status only to those records", async () => {
  const apply = jest.fn().mockResolvedValue(undefined);
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  Element.prototype.scrollIntoView = jest.fn();
  render(
    <KeyboardNavigationProvider value={true}>
      <main data-admin-main>
        <KeyboardCollection
          items={[{ id: "one" }, { id: "two" }, { id: "three" }]}
          getItemId={(item) => item.id}
          actions={[
            {
              key: "s",
              label: "Status",
              options: [{ value: "done", label: "Done" }],
              apply,
            },
          ]}
        >
          <CollectionRecord id="one">One</CollectionRecord>
          <CollectionRecord id="two">Two</CollectionRecord>
          <CollectionRecord id="three">Three</CollectionRecord>
        </KeyboardCollection>
      </main>
    </KeyboardNavigationProvider>,
  );
  fireEvent.keyDown(document.body, { key: "j" });
  fireEvent.keyDown(document.activeElement!, { key: "x" });
  fireEvent.keyDown(document.activeElement!, { key: "j", shiftKey: true });
  expect(screen.getByText("2 selected")).toBeTruthy();
  const clear = screen.getByRole('button', { name: 'Clear selection' });
  expect(clear.textContent).toBe('');
  expect(screen.getByRole('toolbar', { name: 'Selected records' }).className).toContain('flex-nowrap');
  fireEvent.keyDown(document.activeElement!, { key: "s" });
  fireEvent.click(screen.getByRole("option", { name: /Done/ }));
  await waitFor(() => expect(apply).toHaveBeenCalledTimes(2));
  expect(apply.mock.calls).toEqual([
    [{ id: "one" }, "done"],
    [{ id: "two" }, "done"],
  ]);
});

it("reports partial failure and retries only failed records through the keyboard picker", async () => {
  const apply = jest
    .fn()
    .mockImplementation((item: { id: string }) =>
      item.id === "one" && apply.mock.calls.length === 1
        ? Promise.reject(new Error("Conflict"))
        : Promise.resolve(),
    );
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  render(
    <KeyboardNavigationProvider value={true}>
      <main data-admin-main>
        <KeyboardCollection
          items={[{ id: "one" }, { id: "two" }]}
          getItemId={(item) => item.id}
          actions={[
            {
              key: "s",
              label: "Status",
              options: [{ value: "done", label: "Done" }],
              apply,
            },
          ]}
        >
          <CollectionRecord id="one">One</CollectionRecord>
          <CollectionRecord id="two">Two</CollectionRecord>
        </KeyboardCollection>
      </main>
    </KeyboardNavigationProvider>,
  );
  fireEvent.keyDown(document.body, { key: "j" });
  fireEvent.keyDown(document.activeElement!, { key: "x" });
  fireEvent.keyDown(document.activeElement!, { key: "j", shiftKey: true });
  fireEvent.keyDown(document.activeElement!, { key: "s" });
  fireEvent.keyDown(screen.getByPlaceholderText("Search options…"), {
    key: "Enter",
  });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("1 record(s)"),
  );
  expect(screen.getByText("1 selected")).toBeTruthy();
  fireEvent.keyDown(screen.getByPlaceholderText("Search options…"), {
    key: "Enter",
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(apply.mock.calls.map(([item]) => item.id)).toEqual([
    "one",
    "two",
    "one",
  ]);
});

it("leaves Enter on the selection button to its native action instead of opening the record", () => {
  const open = jest.fn();
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  render(
    <KeyboardNavigationProvider value={true}>
      <main data-admin-main>
        <KeyboardCollection
          items={[{ id: "one" }]}
          getItemId={(item) => item.id}
          onOpen={open}
          actions={[
            { key: "s", label: "Status", options: [], apply: jest.fn() },
          ]}
        >
          <CollectionRecord id="one">One</CollectionRecord>
        </KeyboardCollection>
      </main>
    </KeyboardNavigationProvider>,
  );
  const select = screen.getByRole("button", { name: "Select record" });
  act(() => select.focus());
  expect(fireEvent.keyDown(select, { key: "Enter" })).toBe(true);
  expect(open).not.toHaveBeenCalled();
});

it("keeps sortable board cards named by their content without a checkbox", () => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn(),
  }));
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn(),
  });
  const items = [{ id: "one", status: "backlog" }];
  render(
    <KeyboardNavigationProvider value={true}>
      <KeyboardCollection items={items} getItemId={item => item.id} actions={[
        { key: "s", label: "Status", options: [], apply: jest.fn() },
      ]}>
        <KanbanBoard hideToolbar items={items} getItemId={item => item.id}
          columnDefs={[{ key: "status", label: "Status", getValue: item => item.status,
            options: [{ value: "backlog", label: "Backlog" }], onValueChange: jest.fn() }]}
          activeColumnKey="status" rightPills={[]}
          renderCard={() => <div>Board drag check 001 <button>Urgent</button></div>}
        />
      </KeyboardCollection>
    </KeyboardNavigationProvider>,
  );
  const card = screen.getByRole("button", { name: /^Board drag check 001 / });
  const content = document.getElementById(card.getAttribute("aria-labelledby")!);
  expect(content?.textContent).toBe("Board drag check 001 Urgent");
  expect(screen.queryByRole("button", { name: "Select record" })).toBeNull();
});


it("opens the status select with Space and applies its numbered option without a separate dialog", async () => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = jest.fn().mockReturnValue({matches:false,addEventListener:jest.fn(),removeEventListener:jest.fn()});
  jest.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const apply = jest.fn().mockResolvedValue(undefined);
  render(<KeyboardNavigationProvider value={true}><main data-admin-main><KeyboardCollection items={[{id:'one'}]} getItemId={item=>item.id} actions={[{key:'s',label:'Status',options:[{value:'done',label:'Done'}],apply}]}><CollectionRecord id="one">One</CollectionRecord></KeyboardCollection></main></KeyboardNavigationProvider>);
  fireEvent.keyDown(document.body,{key:'j'});
  fireEvent.keyDown(document.activeElement!,{key:' '});
  expect(screen.queryByRole('heading',{name:/record/})).toBeNull();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const input = screen.getByRole('combobox');
  expect(screen.getByRole('option',{name:/Done/}).textContent).toContain('1');
  fireEvent.keyDown(input,{key:'1'});
  await waitFor(()=>expect(apply).toHaveBeenCalledWith({id:'one'},'done'));
});


it("hides a retained selection menu with its inactive pane and restores it without losing selection", async () => {
  jest.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const fixture = (hidden: boolean) => <KeyboardNavigationProvider value={true}><main data-admin-main><div hidden={hidden}><KeyboardCollection items={[{id:'one'}]} getItemId={item=>item.id} actions={[{key:'s',label:'Status',options:[],apply:jest.fn()}]}><CollectionRecord id="one">One</CollectionRecord></KeyboardCollection></div></main></KeyboardNavigationProvider>;
  const view = render(fixture(false));
  fireEvent.keyDown(document.body,{key:'j'}); fireEvent.keyDown(document.activeElement!,{key:'x'});
  expect(screen.getByRole('toolbar',{name:'Selected records'})).toBeTruthy();
  view.rerender(fixture(true));
  await waitFor(()=>expect(screen.queryByRole('toolbar',{name:'Selected records'})).toBeNull());
  view.rerender(fixture(false));
  await waitFor(()=>expect(screen.getByText('1 selected')).toBeTruthy());
});


it("opens the existing row pill and uses the same native picker for bulk changes", async () => {
  jest.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const native = jest.fn(), bulk = jest.fn().mockResolvedValue(undefined);
  const options = [{value:'todo',label:'Todo'},{value:'done',label:'Done'}];
  const picker = () => <SearchableSelect items={options} value={options[0]} getItemId={option=>option.value} getItemLabel={option=>option.label} onValueChange={native} searchPlaceholder="Native status choices" trigger={<button>Native status pill</button>} />;
  render(<KeyboardNavigationProvider value={true}><main data-admin-main><KeyboardCollection items={[{id:'one'},{id:'two'}]} getItemId={item=>item.id} actions={[{key:'s',label:'Status',options,apply:bulk}]} renderAction={picker}>
    <CollectionRecord id="one"><CollectionField field="status">{picker()}</CollectionField></CollectionRecord>
    <CollectionRecord id="two"><CollectionField field="status">{picker()}</CollectionField></CollectionRecord>
  </KeyboardCollection></main></KeyboardNavigationProvider>);
  fireEvent.keyDown(document.body,{key:'j'}); fireEvent.keyDown(document.activeElement!,{key:' '});
  expect(screen.getByPlaceholderText('Native status choices')).toBeTruthy();
  expect(screen.queryByRole('toolbar',{name:'Selected records'})).toBeNull();
  fireEvent.keyDown(screen.getByRole('combobox'),{key:'2'});
  await waitFor(()=>expect(native).toHaveBeenCalledWith(options[1]));
  await waitFor(()=>expect(screen.queryByRole('combobox')).toBeNull());
  fireEvent.keyDown(document.activeElement!,{key:'x'}); fireEvent.keyDown(document.activeElement!,{key:'j',shiftKey:true});
  expect(screen.getByRole('button', { name: 'Status' })).toBeTruthy();
  fireEvent.keyDown(document.activeElement!,{key:'s'});
  fireEvent.keyDown(screen.getByRole('combobox'),{key:'2'});
  await waitFor(()=>expect(bulk).toHaveBeenCalledTimes(2));
  expect(native).toHaveBeenCalledTimes(1);
});


it.each([false,true])('targets the hovered row unless a bulk selection owns the action (bulk=%s)', async bulkSelected => {
  jest.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const apply=jest.fn().mockResolvedValue(undefined);
  render(<KeyboardNavigationProvider value={true}><main data-admin-main><KeyboardCollection items={[{id:'one'},{id:'two'}]} getItemId={item=>item.id} actions={[{key:'s',label:'Status',options:[{value:'done',label:'Done'}],apply}]}>
    <CollectionRecord id="one">One</CollectionRecord><CollectionRecord id="two">Two</CollectionRecord>
  </KeyboardCollection></main></KeyboardNavigationProvider>);
  fireEvent.keyDown(document.body,{key:'j'});
  if (bulkSelected) fireEvent.keyDown(document.activeElement!,{key:'x'});
  const second=screen.getByText('Two').closest('[data-keyboard-record]')!;
  fireEvent.mouseEnter(second);
  expect(screen.getByText('One').closest('[data-keyboard-record]')?.className).not.toContain('ring-1');
  fireEvent.keyDown(document.body,{key:'s'});
  fireEvent.click(screen.getByRole('option',{name:/Done/}));
  await waitFor(()=>expect(apply).toHaveBeenCalledWith({id:bulkSelected?'one':'two'},'done'));
  expect(apply).toHaveBeenCalledTimes(1);
});

it('keeps a bulk selection authoritative when focus moves to the accessory pane', async () => {
  jest.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const apply=jest.fn().mockResolvedValue(undefined);
  render(<KeyboardNavigationProvider value={true}><main data-admin-main><KeyboardCollection items={[{id:'one'}]} getItemId={item=>item.id} actions={[{key:'s',label:'Status',options:[{value:'done',label:'Done'}],apply}]}><CollectionRecord id="one">One</CollectionRecord></KeyboardCollection></main><aside data-accessory-tab="task"><button>Task detail</button></aside></KeyboardNavigationProvider>);
  fireEvent.keyDown(document.body,{key:'j'}); fireEvent.keyDown(document.activeElement!,{key:'x'});
  screen.getByRole('button',{name:'Task detail'}).focus();
  expect(screen.getByRole('toolbar',{name:'Selected records'})).toBeTruthy();
  fireEvent.keyDown(document.activeElement!,{key:'s'});
  fireEvent.click(screen.getByRole('option',{name:/Done/}));
  await waitFor(()=>expect(apply).toHaveBeenCalledWith({id:'one'},'done'));
});


it('clears keyboard-only highlights when the pointer enters an email in another pane', async () => {
  jest.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  render(<KeyboardNavigationProvider value={true}><main data-admin-main><KeyboardCollection items={[{id:'one'}]} getItemId={item=>item.id} actions={[{key:'s',label:'Status',options:[],apply:jest.fn()}]}><CollectionRecord id="one">One</CollectionRecord></KeyboardCollection></main><aside data-accessory-tab="mail"><div data-email-shortcut-target>Email row</div></aside></KeyboardNavigationProvider>);
  fireEvent.keyDown(document.body,{key:'j'});
  expect(screen.getByText('One').closest('[data-keyboard-record]')?.className).toContain('ring-1');
  fireEvent.pointerOver(screen.getByText('Email row'));
  await waitFor(()=>expect(screen.getByText('One').closest('[data-keyboard-record]')?.className).not.toContain('ring-1'));
});

it('keeps a fallback native date picker mounted and applies its chosen date once', async () => {
  jest.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const apply=jest.fn().mockResolvedValue(undefined);
  render(<KeyboardNavigationProvider value={true}><main data-admin-main><KeyboardCollection items={[{id:'one'}]} getItemId={item=>item.id} actions={[{key:'d',kind:'date',label:'Due date',options:[],apply}]} renderAction={()=> <SmartDatePickerPill value={null} onChange={jest.fn()} />}><CollectionRecord id="one">One</CollectionRecord></KeyboardCollection></main></KeyboardNavigationProvider>);
  fireEvent.keyDown(document.body,{key:'j'});fireEvent.keyDown(document.activeElement!,{key:'d'});
  const input=await screen.findByRole('textbox',{name:'Type a date'});
  expect(screen.getByRole('toolbar',{name:'Selected records'}).contains(input)).toBe(true);
  fireEvent.change(input,{target:{value:'tomorrow'}});fireEvent.keyDown(input,{key:'Enter'});
  await waitFor(()=>expect(apply).toHaveBeenCalledTimes(1));
  expect(apply.mock.calls[0][0]).toEqual({id:'one'});expect(apply.mock.calls[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}/);
});


it('clears bulk estimates using the native picker None option', async () => {
  jest.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  const apply=jest.fn().mockResolvedValue(undefined), options=[{id:'none',value:null,label:'None'},{id:'1',value:1,label:'1 point'}];
  render(<KeyboardNavigationProvider value={true}><main data-admin-main><KeyboardCollection items={[{id:'one'}]} getItemId={item=>item.id} actions={[{key:'e',label:'Estimate',options,apply}]} renderAction={()=> <SearchableSelect items={options} value={options[1]} getItemId={item=>item.id} getItemLabel={item=>item.label} onValueChange={jest.fn()} />}><CollectionRecord id="one">One</CollectionRecord></KeyboardCollection></main></KeyboardNavigationProvider>);
  fireEvent.keyDown(document.body,{key:'j'});fireEvent.keyDown(document.activeElement!,{key:'x'});fireEvent.keyDown(document.activeElement!,{key:'e'});
  fireEvent.click(screen.getByRole('option',{name:/None/}));
  await waitFor(()=>expect(apply).toHaveBeenCalledWith({id:'one'},null));
});
