'use client'

import Link from 'next/link'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui'
import { MoreHorizontal } from 'lucide-react'

export type UcatRowAction = {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  href?: string
  destructive?: boolean
}

export function UcatRowActions({ actions }: { actions: UcatRowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => {
          const className = action.destructive
            ? '!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10'
            : undefined

          if (action.href) {
            return (
              <DropdownMenuItem key={action.label} asChild className={className}>
                <Link href={action.href}>
                  {action.icon ? <span className="mr-2 inline-flex h-4 w-4">{action.icon}</span> : null}
                  {action.label}
                </Link>
              </DropdownMenuItem>
            )
          }

          return (
            <DropdownMenuItem key={action.label} onClick={action.onClick} className={className}>
              {action.icon ? <span className="mr-2 inline-flex h-4 w-4">{action.icon}</span> : null}
              {action.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
