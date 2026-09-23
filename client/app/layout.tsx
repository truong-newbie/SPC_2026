import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SPC_2026 - P2P File Transfer',
  description: 'Secure peer-to-peer file transfer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900">
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
