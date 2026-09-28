import type { Metadata, Viewport } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import { SCRIPT_THEME_INITIAL } from '@/lib/theme'
import { EnregistrementServiceWorker } from '@/components/EnregistrementServiceWorker'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const outfit = Outfit({ variable: '--font-outfit', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'PCAS', template: '%s · PCAS' },
  description: 'Plateforme de Commercialisation Agricole du Sénégal — un produit DembaSolution.',
  applicationName: 'PCAS',
  appleWebApp: { capable: true, title: 'PCAS', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#163A27',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} ${outfit.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME_INITIAL }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <EnregistrementServiceWorker />
      </body>
    </html>
  )
}
