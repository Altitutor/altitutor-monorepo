import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './styles/globals.css'
import { ThemeProvider, Navbar, MainContent } from '@/shared/components'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
// Legacy DbProvider removed under migration
import { AuthProvider } from '@/features/auth/providers'
import { ReactQueryProvider } from '@/shared/lib/react-query/provider'
import { MobileMenuProvider } from '@/shared/contexts/MobileMenuContext'
import { ToastProviderWrapper } from '@/shared/components/toast-provider-wrapper'
import { HapticFeedbackProvider } from '@/shared/components/HapticFeedbackProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Altitutor Tutor',
  description: 'Tutor dashboard for Altitutor staff',
  icons: {
    icon: [
      { url: '/images/logo-icon-light.svg', media: '(prefers-color-scheme: light)' },
      { url: '/images/logo-icon-dark.svg', media: '(prefers-color-scheme: dark)' },
    ],
    apple: '/images/logo-icon-light.svg',
  },
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
            <AuthGuard>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <HapticFeedbackProvider />
                <ToastProviderWrapper>
                  <MobileMenuProvider>
                    <div className="flex flex-col min-h-dvh bg-background dark:bg-brand-dark-bg">
                      <Navbar />
                      <MainContent>{children}</MainContent>
                    </div>
                  </MobileMenuProvider>
                </ToastProviderWrapper>
              </ThemeProvider>
            </AuthGuard>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
} 