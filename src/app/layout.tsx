// src/app/layout.tsx
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { ShellLayout } from '@/components/shell/ShellLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './globals.css';

export const metadata: Metadata = {
  title: 'BigQuery AIF',
  description: 'AI-native BigQuery analytics assistant',
  icons: {
    icon: '/crystal-ball.svg',
    shortcut: '/crystal-ball.svg',
    apple: '/crystal-ball.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
      <head>
        {/* Google Fonts: Google Sans + Material Symbols */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&family=Google+Sans+Mono&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0&display=block"
          rel="stylesheet"
        />
      </head>
      <body>
        <ErrorBoundary>
          <AuthProvider>
            <ShellLayout>
              {children}
            </ShellLayout>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
