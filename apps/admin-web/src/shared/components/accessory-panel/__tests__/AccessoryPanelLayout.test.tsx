import { render } from '@testing-library/react';
import { AccessoryPanelLayout } from '../AccessoryPanelLayout';

let pathname = '/students';
let query = '';
const collapse = jest.fn();
const panel = { expanded: true, width: 520, setWidth: jest.fn(), collapse };
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(query),
}));
jest.mock('@/shared/contexts/AccessoryPanelContext', () => ({ useAccessoryPanel: () => panel }));
jest.mock('../AccessoryTabs', () => ({ AccessoryTabs: () => <div>Accessory tabs</div> }));
jest.mock('@/shared/hooks/usePanelMediaQuery', () => ({ ResponsivePane: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

beforeEach(() => {
  pathname = '/students';
  query = '';
  collapse.mockClear();
  global.ResizeObserver = jest.fn().mockImplementation((callback: ResizeObserverCallback) => ({
    observe: () => callback([{ contentRect: { width: 700 } } as ResizeObserverEntry], {} as ResizeObserver),
    disconnect: jest.fn(),
  }));
});

afterEach(() => { jest.restoreAllMocks(); });

test('mobile primary navigation collapses the accessory panel without unmounting its tabs', () => {
  const view = render(<AccessoryPanelLayout><div>Main</div></AccessoryPanelLayout>);
  expect(collapse).not.toHaveBeenCalled();
  pathname = '/invoices/one';
  view.rerender(<AccessoryPanelLayout><div>Main</div></AccessoryPanelLayout>);
  expect(collapse).toHaveBeenCalledTimes(1);
  expect(view.getByText('Accessory tabs')).toBeInTheDocument();
});

test('mobile query navigation also reveals the primary pane', () => {
  const view = render(<AccessoryPanelLayout><div>Main</div></AccessoryPanelLayout>);
  query = 'page=2';
  view.rerender(<AccessoryPanelLayout><div>Main</div></AccessoryPanelLayout>);
  expect(collapse).toHaveBeenCalledTimes(1);
});

test('the accessory panel overlays the main pane throughout the mobile breakpoint', () => {
  render(<AccessoryPanelLayout><div>Main</div></AccessoryPanelLayout>);
  expect(document.getElementById('admin-accessory-panel')).toHaveAttribute('data-docked', 'false');
});

test('desktop primary navigation keeps the docked accessory panel open', () => {
  const media = window.matchMedia('(min-width: 768px)');
  jest.spyOn(window, 'matchMedia').mockReturnValue({ ...media, matches: true });
  const view = render(<AccessoryPanelLayout><div>Main</div></AccessoryPanelLayout>);
  expect(document.getElementById('admin-accessory-panel')).toHaveAttribute('data-docked', 'true');
  pathname = '/invoices/one';
  view.rerender(<AccessoryPanelLayout><div>Main</div></AccessoryPanelLayout>);
  expect(collapse).not.toHaveBeenCalled();
});
