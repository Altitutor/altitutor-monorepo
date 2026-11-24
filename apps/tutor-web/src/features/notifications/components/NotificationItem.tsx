'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { NotificationRow } from '@altitutor/ui'
import { cn } from '@/shared/utils'
import { formatRelativeDate } from '@/shared/utils/datetime'
import type { Notification } from '../types'
import type { GenerationNotificationProgress } from '../lib/ucat-generation-notification'

interface NotificationItemProps {
  notification: Notification
  isArmed?: boolean
  generationProgress?: GenerationNotificationProgress | null
  onArm: () => void
  onConfirmDismiss: () => void
  onOpen: () => void
}

export function NotificationItem({
  notification,
  isArmed = false,
  generationProgress = null,
  onArm,
  onConfirmDismiss,
  onOpen,
}: NotificationItemProps) {
  const router = useRouter()
  const unread = !notification.read_at
  const isRunningGeneration = generationProgress?.status === 'running'
  const isFailedGeneration = generationProgress?.status === 'failed'
  const isCompletedGeneration = generationProgress?.status === 'completed'
  const canNavigate = Boolean(notification.action_url) && !isRunningGeneration

  const handleClick = () => {
    onOpen()

    if (!canNavigate || !notification.action_url) return

    const actionUrl = notification.action_url
    if (actionUrl.startsWith('http')) {
      window.open(actionUrl, '_blank')
    } else {
      router.push(actionUrl)
    }
  }

  return (
    <NotificationRow
      title={notification.title}
      body={generationProgress?.message ?? notification.body}
      timestamp={notification.created_at ? formatRelativeDate(notification.created_at) : 'unknown'}
      unread={unread}
      icon={generationProgress && (
        <span aria-hidden className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isFailedGeneration ? 'bg-destructive/10 text-destructive'
            : isCompletedGeneration ? 'bg-emerald-500/10 text-emerald-600'
            : 'bg-primary/10 text-primary',
        )}>
          {isFailedGeneration ? <AlertCircle className="size-3.5" />
            : isCompletedGeneration ? <Check className="size-3.5" />
            : <Loader2 className="size-3.5 animate-spin" />}
        </span>
      )}
      details={generationProgress?.status === 'running' && (
        <span className="mt-3 block space-y-1.5">
          <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${generationProgress.percent}%` }} />
          </span>
          {generationProgress.total > 0 && (
            <span className="block text-xs tabular-nums text-muted-foreground">
              {generationProgress.processed} / {generationProgress.total}
            </span>
          )}
        </span>
      )}
      onOpen={handleClick}
      onDismiss={isArmed ? onConfirmDismiss : onArm}
      dismissArmed={isArmed}
    />
  );
}
