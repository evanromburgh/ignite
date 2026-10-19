import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, Montserrat } from 'next/font/google'
import { AuthProvider } from '@/components/auth/auth-provider'
import { SettingsProvider } from '@/components/settings-context'
import { Shell } from '@/components/shell'
import { getProjectSettings } from '@/lib/content'
import './globals.css'
import './feature.css'
import './chat.css'

export const dynamic = 'force-dynamic'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getProjectSettings()
  return {
    title: settings.seoTitle,
    description: settings.seoDescription,
    icons: settings.faviconUrl ? [{ url: settings.faviconUrl }] : undefined,
    openGraph: {
      title: settings.seoTitle,
      description: settings.seoDescription,
      images: settings.seoImageUrl ? [settings.seoImageUrl] : undefined,
    },
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getProjectSettings()
  const theme = Object.entries(settings.theme).map(([key, value]) => `${key}:${value}`).join(';')
  return (
    <html lang="en">
      <head>
        <style>{`:root{${theme}}`}</style>
      </head>
      <body className={`${montserrat.className} ${inter.variable} bg-[#18181b] text-theme-text-primary antialiased`}>
        <SettingsProvider value={settings}>
          <AuthProvider>
            <Shell>{children}</Shell>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  )
}
