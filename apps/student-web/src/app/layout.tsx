import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './styles/globals.css'
import { ThemeProvider } from '@/shared/components'
import { AuthProvider } from '@/features/auth/providers'
import { Navbar } from '@/shared/components'
import { ReactQueryProvider } from '@/shared/lib/react-query/provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Altitutor Student',
  description: 'Student portal for Altitutor',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} style={{ "--navbar-height": "64px" } as React.CSSProperties}>
        <ReactQueryProvider>
          <AuthProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <div className="flex flex-col min-h-screen bg-background dark:bg-brand-dark-bg">
                <Navbar />
                <main className="flex-1 pt-[var(--navbar-height)]">
                  {children}
                </main>
              </div>
            </ThemeProvider>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}


