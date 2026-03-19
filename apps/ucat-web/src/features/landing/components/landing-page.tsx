'use client'

import Link from 'next/link'
import { Button } from '@altitutor/ui'
import { MarketingHeader } from './marketing-header'
import { BrainCircuit, BarChart3, BookOpen } from 'lucide-react'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="pt-20">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:py-28">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            UCAT practice that gets results
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            Full-length mocks, timed practice sets, and progress tracking. Built for students preparing for the UCAT.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-muted/30 px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
              Everything you need to prepare
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-6">
                <BrainCircuit className="h-10 w-10 text-primary" />
                <h3 className="mt-4 font-semibold">Practice sets</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Timed practice across all UCAT sections with instant feedback.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <BarChart3 className="h-10 w-10 text-primary" />
                <h3 className="mt-4 font-semibold">Progress tracking</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  See your strengths and weaknesses with detailed analytics.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <BookOpen className="h-10 w-10 text-primary" />
                <h3 className="mt-4 font-semibold">Full mocks</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Simulate the real exam with timed full-length mock tests.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center">
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              Ready to get started?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Already have an account? Log in to access your dashboard.
            </p>
            <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href="/pricing">View pricing</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
