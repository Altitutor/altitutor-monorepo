'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { Button, Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui'
import { NotificationsButton } from './NotificationsButton'
import { NotificationItem } from './NotificationItem'
import { NotificationsEmptyState } from './NotificationsEmptyState'
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkNotificationsRead,
  useDismissNotifications,
} from '../api'
import {
  isUcatGenerationNotificationType,
  parseUcatGenerationNotificationMetadata,
  resolveGenerationNotificationProgress,
} from '../lib/ucat-generation-notification'
import {
  useDismissUcatGenerationRun,
  useUcatGenerationRuns,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { openUcatGenerationReview } from '@/features/ucat/questions/lib/ucat-generation-review-events'
import type { Notification } from '../types'

type OptimisticGeneration = {
  totalStems: number
  error: string | null
  runId: string | null
}

function buildOptimisticNotification(optimistic: OptimisticGeneration): Notification {
  const failed = optimistic.error != null
  return {
    id: `optimistic-ucat-generation:${optimistic.runId ?? 'pending'}`,
    staff_id: null,
    notification_type: failed ? 'ucat.ai_generation.failed' : 'ucat.ai_generation.running',
    app_scope: 'staff_web',
    title: failed ? 'AI generation failed' : 'AI generation in progress',
    body: optimistic.error ?? 'Starting generation…',
    action_url: null,
    activity_event_id: null,
    dismissed_at: null,
    expires_at: null,
    metadata: {
      generationRunId: optimistic.runId ?? 'pending',
      status: failed ? 'failed' : 'running',
      requestedStemCount: optimistic.totalStems,
      processedStemCount: 0,
      progressMessage: optimistic.error ?? 'Starting generation…',
      message: optimistic.error ?? undefined,
    },
    priority: 'normal',
    read_at: null,
    resolved_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function NotificationsTray() {
  const [isOpen, setIsOpen] = useState(false)
  const [armedIds, setArmedIds] = useState<Set<string>>(new Set())
  const [optimistic, setOptimistic] = useState<OptimisticGeneration | null>(null)
  const { data: notifications = [], isLoading } = useNotifications()
  const { data: unreadCount = 0 } = useUnreadCount()
  const markReadMutation = useMarkNotificationRead()
  const markAllReadMutation = useMarkNotificationsRead()
  const dismissMutation = useDismissNotifications()
  const dismissRunMutation = useDismissUcatGenerationRun()

  const hasRunningGenerationNotification = notifications.some(
    (notification) => notification.notification_type === 'ucat.ai_generation.running',
  )
  const runsQuery = useUcatGenerationRuns(
    hasRunningGenerationNotification || optimistic != null || isOpen,
  )
  const runs = runsQuery.data
  const runsById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof runs>[number]>()
    for (const run of runs ?? []) {
      map.set(run.id, run)
    }
    return map
  }, [runs])

  useEffect(() => {
    const starting = (event: Event) => {
      const detail = (event as CustomEvent<{ totalStems?: number }>).detail
      setOptimistic({ totalStems: detail?.totalStems ?? 0, error: null, runId: null })
    }
    const started = (event: Event) => {
      const detail = (event as CustomEvent<{ runId?: string }>).detail
      setOptimistic((current) => (current
        ? { ...current, runId: detail?.runId ?? null }
        : null))
    }
    const failed = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setOptimistic((current) => ({
        totalStems: current?.totalStems ?? 0,
        error: detail?.message ?? 'Unable to start generation',
        runId: null,
      }))
    }
    window.addEventListener('ucat-generation-starting', starting)
    window.addEventListener('ucat-generation-started', started)
    window.addEventListener('ucat-generation-start-failed', failed)
    return () => {
      window.removeEventListener('ucat-generation-starting', starting)
      window.removeEventListener('ucat-generation-started', started)
      window.removeEventListener('ucat-generation-start-failed', failed)
    }
  }, [])

  useEffect(() => {
    if (!optimistic) return
    if (optimistic.error) return
    const matching = notifications.find((notification) => {
      if (!isUcatGenerationNotificationType(notification.notification_type)) return false
      const metadata = parseUcatGenerationNotificationMetadata(notification.metadata)
      if (optimistic.runId) return metadata?.generationRunId === optimistic.runId
      return notification.notification_type === 'ucat.ai_generation.running'
    })
    if (matching) setOptimistic(null)
  }, [notifications, optimistic])

  const displayNotifications = useMemo(() => {
    if (!optimistic) return notifications
    const optimisticNotification = buildOptimisticNotification(optimistic)
    const withoutMatching = optimistic.runId
      ? notifications.filter((notification) => {
        const metadata = parseUcatGenerationNotificationMetadata(notification.metadata)
        return metadata?.generationRunId !== optimistic.runId
      })
      : notifications
    return [optimisticNotification, ...withoutMatching]
  }, [notifications, optimistic])

  const effectiveUnreadCount = unreadCount + (optimistic && !optimistic.error ? 1 : 0)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setArmedIds(new Set())
    }
  }

  const handleArm = (notificationId: string) => {
    setArmedIds((prev) => new Set(prev).add(notificationId))
  }

  const handleConfirmDismiss = (notification: Notification) => {
    const notificationId = notification.id
    if (!notificationId) return

    setArmedIds((prev) => {
      const next = new Set(prev)
      next.delete(notificationId)
      return next
    })

    if (notificationId.startsWith('optimistic-ucat-generation:')) {
      setOptimistic(null)
      return
    }

    dismissMutation.mutate([notificationId])

    const metadata = parseUcatGenerationNotificationMetadata(notification.metadata)
    if (metadata?.generationRunId) {
      dismissRunMutation.mutate(metadata.generationRunId)
    }
  }

  const handleOpenNotification = (notification: Notification) => {
    if (notification.id?.startsWith('optimistic-ucat-generation:')) return
    if (!notification.read_at && notification.id) {
      markReadMutation.mutate(notification.id)
    }
  }

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault()
    handleOpenChange(!isOpen)
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <NotificationsButton unreadCount={effectiveUnreadCount} onClick={handleTriggerClick} />
      </PopoverTrigger>
      <PopoverContent
        className="w-96 max-w-[calc(100vw-2rem)] p-0 max-h-[80vh] overflow-y-auto !z-[100] bg-popover border shadow-xl"
        side="bottom"
        align="end"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h3 className="font-semibold text-sm">Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {effectiveUnreadCount > 0 ? `${effectiveUnreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          {effectiveUnreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate({ markAllRead: true })}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="divide-y">
          {isLoading && displayNotifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : displayNotifications.length === 0 ? (
            <NotificationsEmptyState />
          ) : (
            displayNotifications.map((notification: Notification) => {
              const metadata = parseUcatGenerationNotificationMetadata(notification.metadata)
              const run = metadata?.generationRunId
                ? runsById.get(metadata.generationRunId) ?? null
                : null
              const generationProgress = resolveGenerationNotificationProgress({
                notificationType: notification.notification_type,
                metadata: notification.metadata,
                body: notification.body,
                run,
              })

              return (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  isArmed={armedIds.has(notification.id ?? '')}
                  generationProgress={generationProgress}
                  onArm={() => notification.id && handleArm(notification.id)}
                  onConfirmDismiss={() => handleConfirmDismiss(notification)}
                  onOpen={() => {
                    handleOpenNotification(notification)
                    const metadata = parseUcatGenerationNotificationMetadata(notification.metadata)
                    const isCompletedGeneration = notification.notification_type === 'ucat.ai_generation.completed'
                      || metadata?.status === 'completed'
                    if (isCompletedGeneration && metadata?.generationRunId) {
                      openUcatGenerationReview(metadata.generationRunId, metadata.generatedStemIds)
                    }
                    if (notification.action_url) {
                      setIsOpen(false)
                    }
                  }}
                />
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
