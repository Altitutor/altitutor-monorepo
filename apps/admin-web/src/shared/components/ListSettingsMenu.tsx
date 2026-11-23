"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@altitutor/ui";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import { listSettingsLinks, type ListSettingsKey } from "@/shared/constants/listSettings";

export function ListSettingsMenu({ list, children, inline = false }: { list: ListSettingsKey; children?: ReactNode; inline?: boolean }) {
  const items = listSettingsLinks[list];

  const menu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="size-8 rounded-full" data-shortcut-menu aria-keyshortcuts="M" aria-label="Page actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.length === 1 ? <DropdownMenuItem asChild><Link href={items[0].href}>Go to settings</Link></DropdownMenuItem> : <DropdownMenuSub><DropdownMenuSubTrigger>Go to settings</DropdownMenuSubTrigger><DropdownMenuSubContent>{items.map((item) => <DropdownMenuItem key={item.href} asChild><Link href={item.href}>{item.title}</Link></DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>}
          {children && <><DropdownMenuSeparator />{children}</>}
        </DropdownMenuContent>
      </DropdownMenu>
  );
  return inline ? menu : <AdminPageActions priority="secondary">{menu}</AdminPageActions>;
}
