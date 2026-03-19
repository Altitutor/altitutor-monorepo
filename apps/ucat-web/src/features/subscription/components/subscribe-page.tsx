'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@altitutor/ui'
import { UcatPageHeader } from '@/features/layout'
import { createUcatCheckoutSession } from '@/features/subscription/api/create-checkout'
import { fetchPublicSubscriptionConfig } from '@/features/subscription/api/fetch-public-subscription-config'
import { defaultPublicSubscriptionConfig } from '@/features/subscription/types/public-subscription-config'
import {
  billingIntervalLabel,
  billingIntervalNoun,
  formatMoneyFromMinorUnits,
} from '@/features/subscription/lib/format-subscription-copy'
import { useAuth } from '@/features/auth'

export function SubscribePage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const canceled = searchParams.get('canceled') === '1'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cfg, setCfg] = useState(defaultPublicSubscriptionConfig)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = await fetchPublicSubscriptionConfig()
      if (!cancelled) setCfg(next)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubscribe = async () => {
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent('/subscribe')}`
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { url } = await createUcatCheckoutSession()
      window.location.href = url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Subscribe to UCAT"
        description="Get full access to the UCAT online platform with practice sets, mocks, and progress tracking"
      />

      {canceled ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          Checkout was canceled. You can try again when you&apos;re ready.
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold">UCAT Online Platform</h3>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Full access to practice sets and mocks</li>
          <li>Progress tracking and analytics</li>
          {cfg.trialDays > 0 ? (
            <li>
              {cfg.trialDays}-day free trial
            </li>
          ) : (
            <li>No trial period — billing starts when you subscribe</li>
          )}
          <li>
            {billingIntervalLabel(cfg.billingInterval)} billing – cancel anytime
          </li>
          {cfg.basePriceCents > 0 ? (
            <li>
              {formatMoneyFromMinorUnits(cfg.basePriceCents, cfg.currency)} per{' '}
              {billingIntervalNoun(cfg.billingInterval)} after
              {cfg.trialDays > 0 ? ' your free trial' : ' signup'}
            </li>
          ) : null}
          <li>
            Earn {formatMoneyFromMinorUnits(cfg.discountPerDayCents, cfg.currency)} off for every{' '}
            {cfg.minQuestionsPerDay} questions you complete in a day
          </li>
        </ul>

        {user ? (
          <Button
            className="mt-6"
            onClick={handleSubscribe}
            disabled={loading}
          >
            {loading ? 'Redirecting...' : 'Subscribe now'}
          </Button>
        ) : (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href={`/signup?redirect=${encodeURIComponent('/subscribe')}`}>
                Create account
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/login?redirect=${encodeURIComponent('/subscribe')}`}>
                Log in
              </Link>
            </Button>
          </div>
        )}

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  )
}
