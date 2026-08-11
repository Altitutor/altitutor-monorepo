import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UcatDeleteConfirmDialog } from '../delete-confirm-dialog'

(globalThis as typeof globalThis & { React: typeof React }).React = React

jest.mock('@altitutor/ui', () => ({
  AlertDialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
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

describe('UcatDeleteConfirmDialog', () => {
  it('closes after a successful confirmation', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined)
    const onOpenChange = jest.fn()

    render(
      <UcatDeleteConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete question stem?"
        description="This content may still be referenced."
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('contains a rejected confirmation and keeps the dialog open', async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error('delete_blocked_by_dependency'))
    const onOpenChange = jest.fn()

    render(
      <UcatDeleteConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete question stem?"
        description="This content may still be referenced."
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
