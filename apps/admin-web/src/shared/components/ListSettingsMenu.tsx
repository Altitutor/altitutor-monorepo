"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@altitutor/ui";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import { listSettingsLinks, type ListSettingsKey } from "@/shared/constants/listSettings";

export function ListSettingsMenu({ list }: { list: ListSettingsKey }) {
  const items = listSettingsLinks[list];

  return (
    <AdminPageActions priority="secondary">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Go to settings">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.length === 1 ? <DropdownMenuItem asChild><Link href={items[0].href}>Go to settings</Link></DropdownMenuItem> : <DropdownMenuSub><DropdownMenuSubTrigger>Go to settings</DropdownMenuSubTrigger><DropdownMenuSubContent>{items.map((item) => <DropdownMenuItem key={item.href} asChild><Link href={item.href}>{item.title}</Link></DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>}
        </DropdownMenuContent>
      </DropdownMenu>
    </AdminPageActions>
  );
}
