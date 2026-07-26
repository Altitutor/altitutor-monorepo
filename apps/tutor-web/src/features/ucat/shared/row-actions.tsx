'use client'

import Link from 'next/link'
import { Fragment } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@altitutor/ui'
import { MoreHorizontal } from 'lucide-react'
import { tutorBtnIconOutline } from '@/shared/lib/tutor-visual'

export type UcatRowSubAction = {
  label: string
  description?: string
  onClick?: () => void
  children?: UcatRowSubAction[]
}

export type UcatRowAction = {
  label: string
  description?: string
  icon?: React.ReactNode
  onClick?: () => void
  href?: string
  destructive?: boolean
  children?: UcatRowSubAction[]
  /** When set, rendered instead of the default action item/submenu. */
  render?: () => React.ReactNode
}

function ActionLabel({ label, description }: { label: string; description?: string }) {
  if (!description) return <>{label}</>

  return (
    <div className="flex min-w-0 max-w-[240px] flex-col gap-0.5">
      <span>{label}</span>
      <span className="truncate text-xs font-normal text-muted-foreground">{description}</span>
    </div>
  )
}

function renderSubAction(action: UcatRowSubAction, key: string) {
  if (action.children && action.children.length > 0) {
    return (
      <DropdownMenuSub key={key}>
        <DropdownMenuSubTrigger className="items-start">
          <ActionLabel label={action.label} description={action.description} />
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {action.children.map((child, index) =>
            renderSubAction(child, `${key}-${child.label}-${index}`),
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    )
  }

  return (
    <DropdownMenuItem key={key} onClick={action.onClick} className="items-start">
      <ActionLabel label={action.label} description={action.description} />
    </DropdownMenuItem>
  )
}

function renderAction(action: UcatRowAction, index: number) {
  if (action.render) {
    return <Fragment key={`${action.label}-${index}`}>{action.render()}</Fragment>
  }

  const className = action.destructive
    ? '!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10'
    : undefined

  if (action.children && action.children.length > 0) {
    return (
      <DropdownMenuSub key={`${action.label}-${index}`}>
        <DropdownMenuSubTrigger className={className}>
          {action.icon ? <span className="mr-2 inline-flex h-4 w-4 shrink-0">{action.icon}</span> : null}
          <ActionLabel label={action.label} description={action.description} />
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {action.children.map((child, childIndex) =>
            renderSubAction(child, `${action.label}-${child.label}-${childIndex}`),
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    )
  }

  if (action.href) {
    return (
      <DropdownMenuItem key={`${action.label}-${index}`} asChild className={className}>
        <Link href={action.href}>
          {action.icon ? <span className="mr-2 inline-flex h-4 w-4 shrink-0">{action.icon}</span> : null}
          <ActionLabel label={action.label} description={action.description} />
        </Link>
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem key={`${action.label}-${index}`} onClick={action.onClick} className={className}>
      {action.icon ? <span className="mr-2 inline-flex h-4 w-4 shrink-0">{action.icon}</span> : null}
      <ActionLabel label={action.label} description={action.description} />
    </DropdownMenuItem>
  )
}

export function UcatRowActions({ actions }: { actions: UcatRowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={tutorBtnIconOutline}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, index) => renderAction(action, index))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
