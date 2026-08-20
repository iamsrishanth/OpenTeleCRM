import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/lib/auth-context'
import { Toaster } from '@/components/ui/sonner'
import SmoothScroll from '@/components/SmoothScroll'

export const metadata: Metadata = {
  title: 'OpenTeleCRM',
  description: 'Telecalling-first sales CRM',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <SmoothScroll />
            {children}
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
