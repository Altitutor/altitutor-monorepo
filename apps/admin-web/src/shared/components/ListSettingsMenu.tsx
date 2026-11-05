"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import { listSettingsLinks, type ListSettingsKey } from "@/shared/constants/listSettings";

export function ListSettingsMenu({ list }: { list: ListSettingsKey }) {
  const items = listSettingsLinks[list];
  if (items.length === 1) {
    return (
      <AdminPageActions priority="secondary">
        <Button asChild variant="outline" size="icon">
          <Link href={items[0].href} aria-label={`Go to ${items[0].title}`}>
            <MoreVertical className="h-4 w-4" />
          </Link>
        </Button>
      </AdminPageActions>
    );
  }

  return (
    <AdminPageActions priority="secondary">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Go to settings">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>{item.title}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </AdminPageActions>
  );
}
