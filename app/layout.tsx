import type { Metadata } from 'next';
import './globals.css';
import FirebaseSyncProvider from '@/components/FirebaseSyncProvider';

export const metadata: Metadata = {
  title: 'Novel Studio',
  description: 'AI-powered novel discussion & scene generator',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <FirebaseSyncProvider>{children}</FirebaseSyncProvider>
      </body>
    </html>
  );
}
