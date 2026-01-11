import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './styles/globals.css'
import { ThemeProvider, ToastProviderWrapper, Navbar, MainContent } from '@/shared/components'
import { AuthProvider } from '@/features/auth/providers'
import { AuthGuard } from '@/features/auth/components'
import { ReactQueryProvider } from '@/shared/lib/react-query/provider'
import { MobileMenuProvider } from '@/shared/contexts/MobileMenuContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Altitutor Student',
  description: 'Student portal for Altitutor',
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
                <ToastProviderWrapper>
                  <MobileMenuProvider>
                    <div className="flex flex-col min-h-screen bg-background dark:bg-brand-dark-bg">
                      <Navbar />
                      <MainContent>
                        {children}
                      </MainContent>
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


