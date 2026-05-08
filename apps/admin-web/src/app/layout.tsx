import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './styles/globals.css'
import { ThemeProvider } from '@/shared/components'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
// Legacy DbProvider removed under migration
import { AuthProvider } from '@/features/auth/providers'
import { ConditionalNavbar } from '@/shared/components/layouts/ConditionalNavbar'
import { ReactQueryProvider } from '@/shared/lib/react-query/provider'
import { MobileMenuProvider } from '@/shared/contexts/MobileMenuContext'
import { CommandPaletteProvider } from '@/shared/contexts/CommandPaletteContext'
import { MentionModalProvider } from '@/shared/components/MentionModalProvider';
import { ToastProviderWrapper } from '@/shared/components/toast-provider-wrapper'
import { MainContentWrapper } from '@/shared/components/layouts/MainContentWrapper'
import { QuickActionsProvider } from '@/shared/contexts/QuickActionsContext'
import { HapticFeedbackProvider } from '@/shared/components/HapticFeedbackProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Altitutor Admin',
  description: 'Administrative dashboard for Altitutor staff',
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
                    <CommandPaletteProvider>
                      <QuickActionsProvider>
                        <MentionModalProvider>
                          <div className="flex flex-col min-h-dvh bg-background dark:bg-brand-dark-bg">
                            <ConditionalNavbar />
                            <MainContentWrapper>
                              {children}
                            </MainContentWrapper>
                          </div>
                        </MentionModalProvider>
                      </QuickActionsProvider>
                    </CommandPaletteProvider>
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
