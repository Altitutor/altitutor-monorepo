import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { AuditCatalogFilterMenu } from '../AuditCatalogFilterMenu'

;(globalThis as typeof globalThis & { React: typeof React }).React = React

jest.mock('@altitutor/ui', () => ({
  DropdownMenuCheckboxItem: ({
    children,
    checked,
    onCheckedChange,
  }: React.PropsWithChildren<{
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }>) => (
    <label>
      <input
        type="checkbox"
        checked={checked === true}
        onChange={() => onCheckedChange?.(!(checked === true))}
      />
      {children}
    </label>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

const RUN = {
  id: '71000000-0000-0000-0000-000000000001',
  title: 'All draft stems',
  status: 'active',
  created_at: '2026-08-19T10:00:00.000Z',
}

describe('AuditCatalogFilterMenu', () => {
  it('selects every stem in an audit from the audit row', () => {
    const onSelectedValuesChange = jest.fn()
    render(
      <AuditCatalogFilterMenu
        runs={[RUN]}
        selectedValues={[]}
        onSelectedValuesChange={onSelectedValuesChange}
      />,
    )

    fireEvent.pointerDown(screen.getByText('All draft stems'))
    expect(onSelectedValuesChange).toHaveBeenCalledWith([RUN.id])
  })

  it('can add a single status from that audit submenu', () => {
    const onSelectedValuesChange = jest.fn()
    render(
      <AuditCatalogFilterMenu
        runs={[RUN]}
        selectedValues={[]}
        onSelectedValuesChange={onSelectedValuesChange}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Failed' }))
    expect(onSelectedValuesChange).toHaveBeenCalledWith([`${RUN.id}:failed`])
  })
})
