import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './styles/globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { DbProvider } from '@/lib/db/context'

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
        <AuthGuard>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <DbProvider>
              <div className="min-h-screen bg-background">
                <div className="fixed top-4 right-4">
                  <ThemeToggle />
                </div>
                {children}
              </div>
            </DbProvider>
          </ThemeProvider>
        </AuthGuard>
      </body>
    </html>
  )
} 