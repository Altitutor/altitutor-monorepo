import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { AUDIT_RUN_STATUSES } from '../../api/audits'
import { AUDIT_RUN_STATUS_LABELS } from '../../lib/audit-run-status'
import {
  auditRunChangeStatusAction,
  UcatAuditRunStatusConfirmDialog,
} from '../UcatAuditRunStatusConfirmDialog'

;(globalThis as typeof globalThis & { React: typeof React }).React = React

jest.mock('@altitutor/ui', () => ({
  AlertDialog: ({
    children,
    open,
  }: React.PropsWithChildren<{ open?: boolean }>) => (open ? <div>{children}</div> : null),
  AlertDialogAction: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
  AlertDialogCancel: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
  AlertDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
}))

describe('auditRunChangeStatusAction', () => {
  it('offers every run status as a submenu item', () => {
    const onRequest = jest.fn()
    const action = auditRunChangeStatusAction(onRequest)

    expect(action.label).toBe('Change status')
    expect(action.children?.map((child) => child.label)).toEqual(
      AUDIT_RUN_STATUSES.map((status) => AUDIT_RUN_STATUS_LABELS[status]),
    )

    action.children?.[2]?.onClick?.()
    expect(onRequest).toHaveBeenCalledWith('completed')
  })
})

describe('UcatAuditRunStatusConfirmDialog', () => {
  it('asks for confirmation before changing status', () => {
    const onConfirm = jest.fn()
    render(
      <UcatAuditRunStatusConfirmDialog
        currentStatus="active"
        nextStatus="cancelled"
        onOpenChange={jest.fn()}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Change this audit to Cancelled?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
