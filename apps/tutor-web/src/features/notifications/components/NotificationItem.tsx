'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2, X } from 'lucide-react'
import { Button } from '@altitutor/ui'
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
    <div
      className={cn(
        'p-4 hover:bg-muted/50 transition-all',
        unread && 'bg-primary/[0.045]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn('flex-1 min-w-0', canNavigate && 'cursor-pointer')}
          onClick={handleClick}
        >
          <div className="flex items-start gap-2">
            {generationProgress ? (
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  isFailedGeneration
                    ? 'bg-destructive/10 text-destructive'
                    : isCompletedGeneration
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-primary/10 text-primary',
                )}
              >
                {isFailedGeneration ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : isCompletedGeneration ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <h4 className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>
                  {notification.title}
                </h4>
                {unread ? (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                ) : null}
              </div>
              {(generationProgress?.message ?? notification.body) ? (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {generationProgress?.message ?? notification.body}
                </p>
              ) : null}
              {generationProgress?.status === 'running' ? (
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${generationProgress.percent}%` }}
                    />
                  </div>
                  {generationProgress.total > 0 ? (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {generationProgress.processed} / {generationProgress.total}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground mt-2">
                {notification.created_at ? formatRelativeDate(notification.created_at) : 'unknown'}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant={isArmed ? 'destructive' : 'outline'}
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            if (isArmed) {
              onConfirmDismiss()
            } else {
              onArm()
            }
          }}
          className={cn(
            'h-8 w-8 flex-shrink-0 transition-all duration-200',
            isArmed && 'scale-110',
          )}
          aria-label={isArmed ? 'Confirm dismiss' : 'Dismiss'}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
