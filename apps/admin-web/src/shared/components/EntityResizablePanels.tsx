"use client";

import type { ReactNode } from "react";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import {
  EntityPropertiesLayout,
  EntityPropertiesToggle,
} from "./EntityPropertiesLayout";

interface EntityResizablePanelsProps {
  id: string;
  main: ReactNode;
  sidebar: ReactNode;
  primaryMinSize?: number;
  secondaryMinSize?: number;
}

export function EntityResizablePanels({
  id,
  main,
  sidebar,
  primaryMinSize,
  secondaryMinSize,
}: EntityResizablePanelsProps) {
  return (
    <EntityPropertiesLayout
      id={`${id}-properties-sidebar`}
      sidebar={sidebar}
      resizable
      primaryMinSize={primaryMinSize}
      secondaryMinSize={secondaryMinSize}
    >
      <AdminPageActions priority="secondary">
        <EntityPropertiesToggle />
      </AdminPageActions>
      {main}
    </EntityPropertiesLayout>
  );
}
