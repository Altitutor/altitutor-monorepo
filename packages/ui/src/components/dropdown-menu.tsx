'use client'

import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'

import { cn } from '../lib/cn'
import { navHoverStyles } from '../lib/styles'
import { useRemountPersistentState } from '../hooks/use-remount-persistent-state'

import { MenuSearchRoot, MenuSearchSub, MenuSearchContent, useMenuEntry, useSubLabel, useMenuSearchEnabled, useMenuSearching, useMenuSubOpen, useMenuSurface, assignMenuRef } from './dropdown-menu-search'

const DropdownMenu = MenuSearchRoot

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const PreserveSubOnNextCloseContext = React.createContext<() => void>(() => {})
const preserveSubCloseUntil = new Map<string, number>()

export function usePreserveDropdownSubOnNextClose() {
  return React.useContext(PreserveSubOnNextCloseContext)
}

const DropdownMenuSub = ({
  persistOpenOnRemountKey,
  open,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub> & {
  persistOpenOnRemountKey?: string
}) => {
  const fallbackKey = React.useId()
  const persistenceKey = persistOpenOnRemountKey ?? fallbackKey
  const [persistentOpen, setPersistentOpen] = useRemountPersistentState(
    persistenceKey,
    false
  )

  const [internalOpen, setInternalOpen] = React.useState(props.defaultOpen ?? false)
  if (!persistOpenOnRemountKey) {
    return <MenuSearchSub open={open ?? internalOpen}><DropdownMenuPrimitive.Sub open={open ?? internalOpen} onOpenChange={next => { setInternalOpen(next); onOpenChange?.(next) }} {...props} /></MenuSearchSub>
  }

  const resolvedOpen = open ?? persistentOpen
  return (
    <MenuSearchSub open={resolvedOpen}><PreserveSubOnNextCloseContext.Provider
      value={() => {
        preserveSubCloseUntil.set(persistenceKey, Date.now() + 750)
      }}
    >
      <DropdownMenuPrimitive.Sub
        open={resolvedOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && (preserveSubCloseUntil.get(persistenceKey) ?? 0) > Date.now()) {
            return
          }
          if (open === undefined) setPersistentOpen(nextOpen)
          onOpenChange?.(nextOpen)
        }}
        {...props}
      />
    </PreserveSubOnNextCloseContext.Provider></MenuSearchSub>
  )
}

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => {
  const node = React.useRef<HTMLDivElement>(null)
  useSubLabel(node, props.disabled ?? false)
  useMenuEntry(node, props.disabled ?? false, true, {content: children})
  return (<DropdownMenuPrimitive.SubTrigger
    ref={value => { node.current=value; assignMenuRef(ref,value) }}
    className={cn(
      'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
      navHoverStyles,
      inset && 'pl-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>)
})
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => {
  const searchable = useMenuSearchEnabled()
  const searching = useMenuSearching()
  const subOpen = useMenuSubOpen()
  const registerSurface = useMenuSurface()
  const setRef = React.useCallback((value: HTMLDivElement | null) => { registerSurface(value); assignMenuRef(ref, value) }, [registerSurface, ref])
  return (<DropdownMenuPrimitive.Portal forceMount={searchable ? true : undefined}>
    <DropdownMenuPrimitive.SubContent
      forceMount={searchable ? true : undefined}
      hidden={searchable && (searching || !subOpen)}
      ref={setRef}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>)
})
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    ><MenuSearchContent>{children}</MenuSearchContent></DropdownMenuPrimitive.Content>
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => {
  const node = React.useRef<HTMLDivElement>(null)
  useMenuEntry(node, props.disabled ?? false, false, { content: props.asChild && React.isValidElement<{children?:React.ReactNode}>(children) ? children.props.children : children })
  return (<DropdownMenuPrimitive.Item
    ref={value => { node.current=value; assignMenuRef(ref,value) }}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      navHoverStyles,
      inset && 'pl-8',
      className
    )}
    {...props}
  >{children}</DropdownMenuPrimitive.Item>)
})
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => {
  const node = React.useRef<HTMLDivElement>(null)
  useMenuEntry(node, props.disabled ?? false, false, {content: children})
  return (<DropdownMenuPrimitive.CheckboxItem
    ref={value => { node.current=value; assignMenuRef(ref,value) }}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      navHoverStyles,
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>)
})
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => {
  const node = React.useRef<HTMLDivElement>(null)
  useMenuEntry(node, props.disabled ?? false, false, {content: children})
  return (<DropdownMenuPrimitive.RadioItem
    ref={value => { node.current=value; assignMenuRef(ref,value) }}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      navHoverStyles,
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>)
})
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-sm font-semibold',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      data-menu-shortcut
      className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
      {...props}
    ><kbd className="inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-border bg-muted/50 px-1 font-sans text-[10px] font-medium">{children}</kbd></span>
  )
}
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} 
