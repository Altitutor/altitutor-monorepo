import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './styles/globals.css'
import { ThemeProvider } from '@/shared/components'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { DbProvider } from '@/shared/lib/supabase/db/context'
import { AuthProvider } from '@/shared/lib/providers'
import { Navbar } from '@/shared/components'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Altitutor Admin',
  description: 'Administrative dashboard for Altitutor staff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} style={{ "--navbar-height": "64px" } as React.CSSProperties}>
        <AuthProvider>
          <AuthGuard>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <DbProvider>
                <div className="flex flex-col min-h-screen bg-background dark:bg-brand-dark-bg">
                  <Navbar />
                  <main className="flex-1 pt-[var(--navbar-height)]">
                    {children}
                  </main>
                </div>
              </DbProvider>
            </ThemeProvider>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  )
} 