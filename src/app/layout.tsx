import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './styles/globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { DbProvider } from '@/lib/db/context'
import { SupabaseProvider } from '@/lib/supabase/provider'
import { Navbar } from '@/components/nav/Navbar'

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
      <body className={inter.className}>
        <SupabaseProvider>
          <AuthGuard>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <DbProvider>
                <div className="min-h-screen bg-background">
                  <Navbar />
                  <main className="pt-16">
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