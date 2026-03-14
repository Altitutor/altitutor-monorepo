'use client';

import { Button } from '@altitutor/ui';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

type ToastFn = ReturnType<typeof import('@altitutor/ui').useToast>['toast'];

type EntityType = 'student' | 'staff' | 'class' | 'subject';

interface EntityCreatedToastParams {
  toast: ToastFn;
  router: AppRouterInstance;
  entityType: EntityType;
  entityId: string;
  /**
   * Optional override for the main message.
   * Defaults to a generic "{Entity} created successfully." message.
   */
  message?: string;
}

function getEntityHref(entityType: EntityType, entityId: string): string {
  switch (entityType) {
    case 'student':
      return `/students/${entityId}`;
    case 'staff':
      return `/staff/${entityId}`;
    case 'class':
      return `/classes/${entityId}`;
    case 'subject':
      return `/subjects/${entityId}`;
    default:
      return '/';
  }
}

function getEntityLabel(entityType: EntityType): string {
  switch (entityType) {
    case 'student':
      return 'View student';
    case 'staff':
      return 'View staff';
    case 'class':
      return 'View class';
    case 'subject':
      return 'View subject';
    default:
      return 'View';
  }
}

export function showEntityCreatedToast(params: EntityCreatedToastParams): void {
  const { toast, router, entityType, entityId, message } = params;

  const href = getEntityHref(entityType, entityId);
  const label = getEntityLabel(entityType);
  const defaultMessage =
    message ??
    (entityType === 'student'
      ? 'Student created successfully.'
      : entityType === 'staff'
      ? 'Staff member created successfully.'
      : entityType === 'class'
      ? 'Class created successfully.'
      : 'Subject created successfully.');

  toast({
    title: 'Success',
    description: (
      <div className="flex items-center gap-2">
        <span>{defaultMessage}</span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => router.push(href)}
        >
          {label}
        </Button>
      </div>
    ),
  });
}

type WorkItemType = 'task' | 'issue' | 'project';

interface WorkItemCreatedToastParams {
  toast: ToastFn;
  entityType: WorkItemType;
  entityId: string;
  /**
   * Optional override for the main message.
   * Defaults to a generic "{Entity} created successfully." message.
   */
  message?: string;
}

function getWorkItemLabel(entityType: WorkItemType): string {
  switch (entityType) {
    case 'task':
      return 'Edit task';
    case 'issue':
      return 'Edit issue';
    case 'project':
      return 'Edit project';
    default:
      return 'Edit';
  }
}

export function showWorkItemCreatedToast(params: WorkItemCreatedToastParams): void {
  const { toast, entityType, entityId, message } = params;

  const label = getWorkItemLabel(entityType);
  const defaultMessage =
    message ??
    (entityType === 'task'
      ? 'Task created successfully.'
      : entityType === 'issue'
      ? 'Issue created successfully.'
      : 'Project created successfully.');

  toast({
    title: 'Success',
    description: (
      <div className="flex items-center gap-2">
        <span>{defaultMessage}</span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent('mentionClick', {
                detail: { id: entityId, type: entityType },
              })
            );
          }}
        >
          {label}
        </Button>
      </div>
    ),
  });
}

