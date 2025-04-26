import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './styles/globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { DbProvider } from '@/lib/db/context'
import { SupabaseProvider } from '@/lib/supabase/provider'
import { Navbar } from '@/components/layouts/Navbar'

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
        <SupabaseProvider>
          <AuthGuard>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <DbProvider>
                <div className="flex flex-col min-h-screen bg-background">
                  <Navbar />
                  <main className="flex-1 pt-[var(--navbar-height)]">
                    {children}
                  </main>
                </div>
              </DbProvider>
            </ThemeProvider>
          </AuthGuard>
        </SupabaseProvider>
      </body>
    </html>
  )
} 